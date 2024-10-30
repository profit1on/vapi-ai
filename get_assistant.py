import requests

# Initialize with your token
token = "9256bd8b-c2a5-41c9-8ee2-b74ae134b02f"  # Replace with your actual token
assistant_id = "bb8fe123-e368-453e-ab79-4e063cf09cf6"  # Replace with your assistant ID

# API endpoint for getting a specific assistant's details
url = f"https://api.vapi.ai/assistant/{assistant_id}"

# Set up headers with authorization
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Make the GET request to retrieve assistant details
response = requests.get(url, headers=headers)

# Check if the request was successful
if response.status_code == 200:
    assistant = response.json()
    print("Assistant Details:", assistant)
else:
    print(f"Failed to retrieve assistant details. Status Code: {response.status_code}")
    print("Error:", response.text)
