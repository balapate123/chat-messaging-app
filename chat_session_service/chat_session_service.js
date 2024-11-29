const amqp = require('amqplib');
const winston = require('winston');

const RABBITMQ_URL = 'amqp://localhost';
let channel;


const sessions = {}; 
const messages = {};


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

  channel.consume('chat_service_queue', async (msg) => {
    const data = JSON.parse(msg.content.toString());
    logger.info(`Received message: ${JSON.stringify(data)}`);

    try {
      if (data.action === 'create_session') {
        await createSession(data.user_id, data.session_id, data.correlation_id);
      } else if (data.action === 'join_session') {
        await joinSession(data.user_id, data.session_id, data.correlation_id);
      } else if (data.action === 'send_message') {
        await sendMessage(data.user_id, data.session_id, data.message, data.correlation_id);
      } else if (data.action === 'fetch_messages') {
        await fetchMessages(data.session_id, data.correlation_id);
      }

      channel.ack(msg); 
    } catch (error) {
      logger.error('Error processing message:', error);

     
      channel.sendToQueue(
        'response_queue',
        Buffer.from(
          JSON.stringify({
            session_id: data.session_id,
            correlation_id: data.correlation_id,
            error: error.message,
          })
        )
      );

      channel.ack(msg); 
    }
  });
}

// Create a new session
async function createSession(user_id, session_id, correlation_id) {
  if (sessions[session_id]) {
    throw new Error(`Session ${session_id} already exists`);
  }
  sessions[session_id] = [user_id];
  messages[session_id] = [];

  logger.info(`Sessions after creation: ${JSON.stringify(sessions)}`);

  channel.sendToQueue(
    'response_queue',
    Buffer.from(
      JSON.stringify({
        session_id,
        correlation_id,
        message: `Session ${session_id} created successfully`,
      })
    )
  );
}

// Join an existing session
async function joinSession(user_id, session_id, correlation_id) {
  if (!sessions[session_id]) {
    channel.sendToQueue(
      'response_queue',
      Buffer.from(
        JSON.stringify({
          session_id,
          correlation_id,
          error: `Session ${session_id} does not exist`,
        })
      )
    );
    throw new Error(`Session ${session_id} does not exist`);
  }

  if (!sessions[session_id].includes(user_id)) {
    sessions[session_id].push(user_id);
    logger.info(`User ${user_id} joined session ${session_id}`);
    channel.sendToQueue(
      'response_queue',
      Buffer.from(
        JSON.stringify({
          session_id,
          correlation_id,
          message: `User ${user_id} joined session ${session_id}`,
        })
      )
    );
  } else {
    channel.sendToQueue(
      'response_queue',
      Buffer.from(
        JSON.stringify({
          session_id,
          correlation_id,
          message: `User ${user_id} is already part of session ${session_id}`,
        })
      )
    );
  }
}

// Send a message to a session
async function sendMessage(user_id, session_id, message, correlation_id) {
  if (!sessions[session_id]) {
    channel.sendToQueue(
      'response_queue',
      Buffer.from(
        JSON.stringify({
          session_id,
          correlation_id,
          error: `Session ${session_id} does not exist`,
        })
      )
    );
    throw new Error(`Session ${session_id} does not exist`);
  }

  if (!sessions[session_id].includes(user_id)) {
    channel.sendToQueue(
      'response_queue',
      Buffer.from(
        JSON.stringify({
          session_id,
          correlation_id,
          error: `User ${user_id} is not part of session ${session_id}`,
        })
      )
    );
    throw new Error(`User ${user_id} is not part of session ${session_id}`);
  }

  const timestamp = new Date().toISOString();
  messages[session_id].push({ user_id, message, timestamp });

  channel.sendToQueue(
    'response_queue',
    Buffer.from(
      JSON.stringify({
        session_id,
        correlation_id,
        message: `Message sent to session ${session_id}`,
      })
    )
  );

  logger.info(`Messages after sending: ${JSON.stringify(messages)}`);
}

// Fetch messages from a session
async function fetchMessages(session_id, correlation_id) {
  if (!messages[session_id]) {
    channel.sendToQueue(
      'response_queue',
      Buffer.from(
        JSON.stringify({
          session_id,
          correlation_id,
          error: `Session ${session_id} does not exist`,
        })
      )
    );
    throw new Error(`Session ${session_id} does not exist`);
  }

  channel.sendToQueue(
    'response_queue',
    Buffer.from(
      JSON.stringify({
        session_id,
        correlation_id,
        messages: messages[session_id],
      })
    )
  );
}

// Start Chat Session Service
connectToRabbitMQ().then(() => {
  logger.info('Chat Session Service is running...');
});
