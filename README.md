
# Chat Messaging System

A basic chat messaging system built with Node.js, RabbitMQ, and Express. This project demonstrates inter-service communication using RabbitMQ queues to handle chat sessions and messaging between users.

## Features

- Create a new chat session
- Join an existing chat session
- Send messages in a session
- Fetch messages from a session

## Technologies Used

- **Node.js**: Server-side JavaScript runtime
- **RabbitMQ**: Message broker for inter-service communication
- **Express**: Web framework for the API service
- **amqplib**: RabbitMQ client library for Node.js
- **Winston**: Logging library

## Requirements

- Node.js (>= 14.0.0)
- RabbitMQ

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/balapate123/chat-messaging.git
cd chat-messaging
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start RabbitMQ

Ensure RabbitMQ is installed and running:

```bash
rabbitmq-server
```

### 4. Run the services

#### API Service
```bash
node api_service.js
```

#### Chat Session Service
```bash
node chat_session_service.js
```

## API Endpoints

### POST `/api/chats/create`
Create a new chat session.

#### Request Body:
```json
{
  "user_id": "user1"
}
```

#### Response:
```json
{
  "is_success": true,
  "session_id": "1638032939094"
}
```

### POST `/api/chats/join`
Join an existing chat session.

#### Request Body:
```json
{
  "user_id": "user2",
  "session_id": "1638032939094"
}
```

#### Response:
```json
{
  "is_success": true,
  "message": "User user2 joined session 1638032939094"
}
```

### POST `/api/chats/send`
Send a message in a session.

#### Request Body:
```json
{
  "user_id": "user1",
  "session_id": "1638032939094",
  "message": "Hello!"
}
```

#### Response:
```json
{
  "is_success": true,
  "message": "Message sent to session 1638032939094"
}
```

### GET `/api/chats/messages/:session_id`
Fetch messages from a session.

#### Response:
```json
{
  "messages": [
    {
      "user_id": "user1",
      "message": "Hello!",
      "timestamp": "2024-11-29T22:42:07.033Z"
    }
  ]
}
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.
