import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv('server/.env')
api_key = os.getenv('GROQ_API_KEY')
model = os.getenv('GROQ_MODEL', 'qwen/qwen3.8-27b')

# 10x10 valid PNG (red square)
png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC")
b64 = base64.b64encode(png_data).decode('utf-8')
data_url = f"data:image/png;base64,{b64}"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "model": model,
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What is in this image?"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": data_url
                    }
                }
            ]
        }
    ],
    "max_tokens": 50
}

response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
print(response.status_code)
print(response.text)
