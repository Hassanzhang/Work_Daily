FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --no-cache-dir \
    -r /app/requirements.txt

COPY main.py /app/main.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
