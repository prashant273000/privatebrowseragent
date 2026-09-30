import os
import requests
from dotenv import load_dotenv

load_dotenv('server/.env')
api_key = os.getenv('GROQ_API_KEY')
model = os.getenv('GROQ_MODEL', 'qwen/qwen3.8-27b')

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
                        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/1200px-React-icon.svg.png"
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
