from fastapi import FastAPI, Depends, HTTPException, status, Form, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
#from sqlalchemy.testing.pickleable import User
from starlette import status
from starlette.responses import HTMLResponse, RedirectResponse
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from app.db.database import engine, Base
from app import auth, routes
import logging
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from app.dependencies import oauth2_scheme
from fastapi.middleware.cors import CORSMiddleware



# logger conf
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',  # format
    handlers=[
        logging.FileHandler('app.log'),  # app.log
        logging.StreamHandler()
    ]
)



app = FastAPI()

#CORS
origins = [
    "http://localhost:8084",
    "http://localhost",
    "null",
]

# Добавляем CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # только указанные адреса
    allow_credentials=True,
    allow_methods=["*"],              # можно ограничить (например, ["POST"])
    allow_headers=["*"],              # можно ограничить (например, ["Content-Type"])
)


# настройка инфраструктуры
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

templates_path = os.path.abspath("templates")
print(f"Absolute path to templates: {templates_path}")


app.include_router(auth.router, prefix="/auth", tags=["Auth"]) #auth endpoints
app.include_router(routes.router, prefix="/api", tags=["api"]) #users endpoints

Base.metadata.create_all(bind=engine) #create all TABLES in db

logger = logging.getLogger(__name__)
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env") # env url
print(f".env path: {dotenv_path}")


load_dotenv(dotenv_path) # Load .env file

if os.path.exists(dotenv_path):
    logger.info(".env file successfully found.")
else:
    logger.warning(".env file not found or failed to load.")


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

