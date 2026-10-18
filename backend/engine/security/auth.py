"""
backend/engine/security/auth.py
JWT Authentication and Role-Based Access Control (RBAC) (FIX 16 & FIX 17).
Defines roles: VIEWER, OPERATOR, CONTROLLER, ADMIN, SYSTEM.
Protects administrative overrides, incident reporting, and system calibration endpoints.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.eta_models import UserRoleEnum, AdminUser

# Security configuration
JWT_SECRET = "railsync-super-secret-production-key-2026-secure"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)

# Pre-seeded users for authentication & controller operations
SYSTEM_USERS: Dict[str, Dict[str, Any]] = {
    "admin": {
        "user_id": "USR-ADMIN-01",
        "username": "admin",
        "password": "RailSyncAdmin2026!",
        "role": UserRoleEnum.ADMIN
    },
    "controller1": {
        "user_id": "USR-CTRL-01",
        "username": "controller1",
        "password": "ControllerPass2026!",
        "role": UserRoleEnum.CONTROLLER
    },
    "operator1": {
        "user_id": "USR-OPR-01",
        "username": "operator1",
        "password": "OperatorPass2026!",
        "role": UserRoleEnum.OPERATOR
    },
    "viewer1": {
        "user_id": "USR-VIEW-01",
        "username": "viewer1",
        "password": "ViewerPass2026!",
        "role": UserRoleEnum.VIEWER
    }
}

ROLE_HIERARCHY: Dict[UserRoleEnum, int] = {
    UserRoleEnum.VIEWER: 1,
    UserRoleEnum.OPERATOR: 2,
    UserRoleEnum.CONTROLLER: 3,
    UserRoleEnum.ADMIN: 4,
    UserRoleEnum.SYSTEM: 5
}

def create_access_token(user_id: str, username: str, role: UserRoleEnum) -> str:
    """Creates a signed JWT token with role claims."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role.value if hasattr(role, "value") else str(role),
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Authentication token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)) -> Dict[str, Any]:
    """
    Validates token from Authorization: Bearer <token> header.
    Defaults to VIEWER if no token is provided for public read access.
    """
    if not credentials:
        return {
            "user_id": "ANONYMOUS_VIEWER",
            "username": "guest",
            "role": UserRoleEnum.VIEWER
        }
    
    payload = decode_access_token(credentials.credentials)
    role_str = payload.get("role", "VIEWER")
    try:
        role = UserRoleEnum(role_str)
    except ValueError:
        role = UserRoleEnum.VIEWER

    return {
        "user_id": payload.get("sub"),
        "username": payload.get("username"),
        "role": role
    }

def require_role(min_role: UserRoleEnum):
    """
    Dependency factory that enforces minimum role requirement.
    """
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = user.get("role", UserRoleEnum.VIEWER)
        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(min_role, 0):
            raise HTTPException(
                status_code=403,
                detail=f"Access forbidden: requires at least {min_role.value} privileges."
            )
        return user
    return role_checker
