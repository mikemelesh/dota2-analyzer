from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dota2_analyzer.db"
    OPENDOTA_API_KEY: str | None = "a874248a-61e7-4821-9e05-c6a2db9a0004"

    LIVE_UPDATE_INTERVAL_SEC: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
