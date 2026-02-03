from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dota2_analyzer.db"
    OPENDOTA_API_KEY: str | None = None
    LIVE_UPDATE_INTERVAL_SEC: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
