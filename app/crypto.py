# app/core/crypto.py

from passlib.context import CryptContext
from passlib.handlers.pbkdf2 import pbkdf2_sha256

pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")

def hash_password_bcrypt(password: str) -> str:
    """
 bcrypt algorithm
    """
    return pwd_context.hash(password)

def hash_password_pbkdf2(password: str) -> str:
    """
 pbkdf2_sha256 algorithm
    """
    return pbkdf2_sha256.hash(password)

def verify_password_bcrypt(plain_password: str, hashed_password: str) -> bool:
    """
    check pawweord algorithm with bcrypt
    """
    return pwd_context.verify(plain_password, hashed_password)

def verify_password_pbkdf2(plain_password: str, hashed_password: str) -> bool:
    """
    check password algorithm with pbkdf2_sha256
    """
    return pbkdf2_sha256.verify(plain_password, hashed_password)
