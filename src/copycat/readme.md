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



----

Reduce these timeouts pleaes
[Nest] 17268  - 01/30/2025, 7:23:05 PM   ERROR [CopyCatService] Failed to execute action click on element 11
[Nest] 17268  - 01/30/2025, 7:23:05 PM   ERROR [CopyCatService] TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('xpath=/html/body/div[1]/div[3]/form[1]/div[1]/div[1]/div[1]/div[1]/div[3]/div[3]') to be visible
    2 × waiting for navigation to finish...
      - navigated to "https://www.google.com/search?q=chatgpt&sca_esv=95493269825c3f0f&source=hp&ei=DoSbZ-GdFumPvr0P8tSaoAs&iflsig=ACkRmUkAAAAAZ5uSHi1A0t-l7j3mvH866rz15-UrCsAJ&ved=0ahUKEwjh3JDey52LAxXph68BHXKqBrQQ4dUDCBA&…"

If an element is not present in view, don't try to execute the action