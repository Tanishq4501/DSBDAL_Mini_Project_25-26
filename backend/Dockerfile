FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ── pip global config: longer timeout + more retries for large packages ──────
# scipy (35 MB), xgboost (200 MB), numpy (18 MB) routinely time-out on slow
# connections with the default 15-second read timeout.
ENV PIP_DEFAULT_TIMEOUT=300
ENV PIP_RETRIES=10

COPY requirements.txt ./

# Install heaviest packages first so a single retry doesn't re-download
# everything — Docker layer cache keeps them if requirements.txt is unchanged.
RUN pip install --no-cache-dir numpy==1.25.2 scipy
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
