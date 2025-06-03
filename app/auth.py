import os
import secrets
import pytz
from fastapi import Depends, FastAPI, HTTPException, status, Request, Response, Body
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Annotated
from app.db.database import get_db
from app.models import User, RefreshToken
import logging
import jwt
from app.crypto import hash_password_bcrypt,hash_password_pbkdf2,verify_password_bcrypt,verify_password_pbkdf2
from datetime import datetime, timedelta, timezone
from jwt.exceptions import InvalidTokenError
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.dependencies import oauth2_scheme
from jwt import  decode
from jose import JWTError
from typing import Optional







logger = logging.getLogger(__name__)
router = APIRouter()
SECRET_KEY = os.getenv("SECRET_KEY", "0456dffffhtghbvnughjghfg5dfgd57hgbnmbx3e7")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 1))

class UserData(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None


#generate refresh token
def create_refresh_token():
    return secrets.token_hex(32)

#generate jwt token with expire time
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    print(f"Current UTC time: {datetime.now(pytz.utc)}")
    print(f"SECRET_KEY :{SECRET_KEY},ALGORITHM: {ALGORITHM},access_token_expire_minutes: {access_token_expire_minutes}")
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(pytz.utc) + expires_delta
    else:
        expire = datetime.now(pytz.utc) + timedelta(minutes=access_token_expire_minutes)
    print(f"Token expires at: {expire}")  # Логируем время истечения токена
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"Generated JWT: {encoded_jwt}, Expiry: {expire}")
    return encoded_jwt

#check time and token
def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": True})
        print(f"Decoded JWT payload: {payload}")
        return payload
    except jwt.ExpiredSignatureError:
        # Обработка истекшего токена
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except JWTError:
        # Обработка других ошибок JWT
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )



#get user from token
async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)],db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    logger.debug(f"Received token: {token}")
    try:

        payload = decode_access_token(token)
        username = payload.get("sub")  # sub

        logger.debug(f"Decoded payload: {payload}")
        if username is None:
            logger.error("Username is None in the token.")
            raise credentials_exception

        token_data = TokenData(username=username)

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    logger.debug(f"User found: {user.username}")

    if "iat" in payload:
        token_issue_time = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        logger.debug(f"Token issued at (UTC): {token_issue_time}")

    return user



def get_current_active_user(request: Request,db: Session = Depends(get_db)) -> User:
    pass


# login + give JWT-token to user , passw data
@router.post("/token")
async def login_for_access_token(response: Response,form_data: Annotated[OAuth2PasswordRequestForm, Depends()],db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.username == form_data.username).first()
    print(f"token user {user}")
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password_bcrypt(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token()
    refresh_token_expires = datetime.now(tz=pytz.utc) + timedelta(days=refresh_token_expire_days)  #datetime.utcnow()
#

    #token_print = Token(access_token=access_token, token_type="bearer")
    print(f"access_token {access_token}")
    print(f"refresh_token {refresh_token}")
    # db refresh token save
    db_refresh = RefreshToken(user_id=user.id, token=refresh_token, expires_at=refresh_token_expires)
    db.add(db_refresh)
    db.commit()
    #User.disabled = False

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,  # недоступен через JS
        secure=True,  # доступен только по HTTPS
        samesite="Strict",  # защищает от CSRF атак
        expires=int(refresh_token_expires.timestamp())  # устанавливаем время истечения для куки
    )


    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh")
async def refresh_access_token(request: Request, db: Session = Depends(get_db)):
    print(f"REFRESH endpoint:")
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token found in cookies")
    try:
        db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
        print(f"RefreshToken.token:{RefreshToken.token},refresh_token:{refresh_token}")
        print(f"db_token.expires_at:{db_token.expires_at},datetime.now(pytz.utc):{datetime.now(pytz.utc)} ")
        if not db_token:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

        if db_token.expires_at < datetime.now(pytz.utc):
            raise HTTPException(status_code=401, detail="Refresh token has expired")

        user = db.query(User).filter(User.id == db_token.user_id).first()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # new access token
        access_token_expires = timedelta(minutes=access_token_expire_minutes)
        access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
        print(f"new access:{access_token}")
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


#logout user
@router.post("/logout")
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token not found in cookies")

    # delete refresh token from db
    db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if db_token:
        db.delete(db_token)
        db.commit()

    # delete tokens from cookie
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return JSONResponse(status_code=200, content={"message": "Logged out"})


#register user
@router.post("/register")
def register(user_data: UserData, db: Session = Depends(get_db)):
    logger.info("/register endpoint - Attempt to register user: %s", user_data.username)
    user = db.query(User).filter(User.username == user_data.username).first()  # check username
    logger.info("user from db query result: %s", user)
    if user:
        raise HTTPException(status_code=400, detail="User already exists")
    if user != None:
        logger.info("user from db is not None:")
        raise HTTPException(status_code=400, detail="User already exists")

    if user_data.username:
        new_user = User(
            username=user_data.username,
            password_hash= hash_password_bcrypt(user_data.password)  # hash password
        )
        db.add(new_user)
        db.commit()

        logger.info("User %s registered successfully", user_data.username)
        return JSONResponse(content={"message": "User registered successfully"}, status_code=201)
    else:
        raise HTTPException(status_code=400, detail="Username is empty")

#if access token is valid for user
@router.get("/access-token-login")
async def protected_resource(request: Request,current_user: User = Depends(get_current_user)):
    logger.info(" access-token-login for user: %s", current_user.username)

    cookies = request.cookies
    logger.debug(f"Cookies in request: {cookies}")

    token = request.cookies.get("access_token")
    if token:
        logger.debug(f"Received token from cookie: {token}")
        try:
            payload = decode_access_token(token)
            exp_time = payload.get("exp")
            if exp_time:
                from datetime import datetime, timezone
                token_expiry = datetime.fromtimestamp(exp_time, tz=timezone.utc)
                logger.debug(f"Token expiration time (UTC): {token_expiry}")
            else:
                logger.warning("Token does not have an expiration field.")
        except Exception as e:
            logger.error(f"Error decoding token: {e}")
    return {"message": f"Hello, {current_user.username}!", "user": current_user.username}