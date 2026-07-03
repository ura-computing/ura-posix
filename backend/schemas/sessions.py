from datetime import datetime

from pydantic import BaseModel


class SessionOut(BaseModel):
    id:             str          # stringified for stable frontend cache keys
    device_label:   str
    ip:             str
    last_active_at: datetime     # maps from sessions.last_used_at
    is_current:     bool