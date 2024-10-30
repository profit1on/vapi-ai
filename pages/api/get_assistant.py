from vapi import Vapi

# Initialize the client with your token
client = Vapi(
    token="9256bd8b-c2a5-41c9-8ee2-b74ae134b02f",  # Your actual token
)

# Specify the assistant ID
assistant_id = "bb8fe123-e368-453e-ab79-4e063cf09cf6"  # Your assistant ID
assistant = client.assistants.get(id=assistant_id)

# Print the assistant details
print(assistant)
