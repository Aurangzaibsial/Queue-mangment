FROM python:3.12-slim

WORKDIR /app

COPY python-ai-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY python-ai-service/*.py ./
COPY ["ai model/smart_queue_model_v2_colab.json", "./ai model/smart_queue_model_v2_colab.json"]

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]