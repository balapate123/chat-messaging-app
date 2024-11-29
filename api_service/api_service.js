const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const winston = require('winston');

const app = express();
app.use(bodyParser.json());

const RABBITMQ_URL = 'amqp://localhost';
let channel;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Connect to RabbitMQ
async function connectToRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue('chat_service_queue', { durable: true });
  await channel.assertQueue('response_queue', { durable: true });
  logger.info('Connected to RabbitMQ');
}

// Publish to RabbitMQ
async function publishToQueue(queue, message) {
  await channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
}

// Create a session
app.post('/api/chats/create', async (req, res) => {
  const { user_id } = req.body;
  const session_id = new Date().getTime().toString(); 
  try {
    await publishToQueue('chat_service_queue', { user_id, session_id, action: 'create_session' });
    res.json({ is_success: true, session_id });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'Error creating session' });
  }
});

// Join a session
app.post('/api/chats/join', async (req, res) => {
  const { user_id, session_id } = req.body;
  try {
    await publishToQueue('chat_service_queue', { user_id, session_id, action: 'join_session' });
    res.json({ is_success: true, message: `User ${user_id} joined session ${session_id}` });
  } catch (error) {
    logger.error('Error joining session:', error);
    res.status(500).json({ error: 'Error joining session' });
  }
});

// Send a message
app.post('/api/chats/send', async (req, res) => {
  const { user_id, session_id, message } = req.body;

  try {
    const correlationId = new Date().getTime().toString(); 

    
    await publishToQueue('chat_service_queue', {
      user_id,
      session_id,
      message,
      action: 'send_message',
      correlation_id: correlationId,
    });

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.cancel(correlationId); // Cleanup consumer on timeout
        reject(new Error('Response timeout'));
      }, 5000); 

      channel.consume(
        'response_queue',
        (msg) => {
          const data = JSON.parse(msg.content.toString());
          if (data.correlation_id === correlationId) {
            clearTimeout(timeout);
            channel.cancel(correlationId); // Cleanup consumer
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data);
            }
            channel.ack(msg);
          }
        },
        { noAck: false, consumerTag: correlationId } 
      );
    });

    res.json({ is_success: true, message: response.message });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(400).json({ error: error.message });
  }
});

// Fetch messages
app.get('/api/chats/messages/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const correlationId = new Date().getTime().toString(); 

    await publishToQueue('chat_service_queue', {
      session_id,
      action: 'fetch_messages',
      correlation_id: correlationId,
    });

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.cancel(correlationId); 
        reject(new Error('Response timeout'));
      }, 5000); 

      channel.consume(
        'response_queue',
        (msg) => {
          const data = JSON.parse(msg.content.toString());
          if (data.correlation_id === correlationId) {
            clearTimeout(timeout);
            channel.cancel(correlationId); 
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.messages);
            }
            channel.ack(msg);
          }
        },
        { noAck: false, consumerTag: correlationId } 
      );
    });

    res.json(response);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(400).json({ error: error.message });
  }
});

// Start API Service
connectToRabbitMQ().then(() => {
  app.listen(5000, () => logger.info('API Service running on port 5000'));
});
