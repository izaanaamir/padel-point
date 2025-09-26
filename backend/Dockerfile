FROM python:3.11-slim

# Install system deps for WeasyPrint (optional)
RUN apt-get update && apt-get install -y \
    build-essential libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
