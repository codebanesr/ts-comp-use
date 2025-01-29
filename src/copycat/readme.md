# Copycat API Documentation

This repository provides APIs for controlling web automation tasks using browser-based services. Below are examples of how to interact with these APIs using `curl` commands.

## Prerequisites
Ensure you have a running instance of the service and replace placeholders such as `<your-service-url>` with the actual URL where your service is hosted.

## API Endpoints

### 1. **Analyze Website**

**Endpoint:** `/copycat/analyze`

**Method:** POST

**Description:** Initiates an analysis on a specified website.

**Request Body:**
```json
{
  "url": "<your-website-url>"
}
```

**cURL Command:**
```sh
curl -X POST 'http://localhost:3000/copycat/analyze' \
-H 'Content-Type: application/json' \
-d '{
  "url": "https://kayak.com"
}'
```

### 2. **Run Automation**

**Endpoint:** `/copycat/run`

**Method:** POST

**Description:** Starts an automated task on a specified website, interacting with elements based on provided instructions.

**Request Body:**
```json
{
  "url": "<your-website-url>",
  "message": "<action-message>"
}
```

**cURL Command:**
```sh
curl -X POST 'http://localhost:3000/copycat/run' \
-H 'Content-Type: application/json' \
-d '{
  "url": "https://kayak.com",
  "message": "Click on the button labeled \"Submit\""
}'
```

### Notes

- Replace `<your-service-url>` with the actual URL where your service is hosted.
- Ensure that the JSON payloads match the expected structure as defined in the API documentation.

These commands will allow you to interact with the web automation APIs and control browser-based tasks programmatically.
