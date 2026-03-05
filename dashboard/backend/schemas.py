from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    pharmacy_name: Optional[str] = None
    profile_complete: bool = False

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    pharmacy_name: Optional[str] = None
    image_url: Optional[str] = None
