from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "SongSpot API"
    frontend_origin: str = "http://localhost:5173"
    database_url: str = "postgresql://songspot:songspot@localhost:5432/songspot"
    redis_url: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
