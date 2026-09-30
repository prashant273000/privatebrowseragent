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
                    "text": "What does the text in this image say?"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://dummyimage.com/200x200/000/fff.png&text=Hello+Groq"
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
