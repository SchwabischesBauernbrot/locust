require('dotenv').config();
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const token = process.env.TOKEN;

async function websocketHandler(payload) {
  const websocket_url = `wss://ws.imprompt.ai/agent-completion?token=${token}`;
  const ws = new WebSocket(websocket_url);

  let received_content = "";

  return new Promise((resolve, reject) => {
    ws.on('open', function open() {
      ws.send(JSON.stringify(payload), (error) => {
        if (error) {
          reject(error);
        }
      });
    });

    ws.on('message', function (message) {
      const message_dict = JSON.parse(message);
      const choices = message_dict.choices || [];

      for (const choice of choices) {
        const delta_content = choice.delta?.content || "";
        received_content += delta_content;
      }
    });

    ws.on('error', function (error) {
      reject(error);
    });

    ws.on('close', function () {
      console.log("Response successful");
      resolve(received_content);
    });
  });
}

app.post('/v1/chat/completions', async (req, res) => {
  const messages = req.body.messages || [];
  const lastcontent = messages.length ? messages[messages.length - 1].content : "";

  const payload = {
    "prompt": lastcontent,
    "agent_id": 1,
    "user_id": 0,
    "conversation": messages,
    "llm_config": {
      "foundation_type": "openai_chatgpt",
      "model": "gpt-4"
    }
  };

  try {
    const received_content = await websocketHandler(payload);

    const id = `chatcmpl-${Math.random().toString(36).slice(2)}`;

    const created = Math.floor(Date.now() / 1000);

    const response = {
      id,
      created,
      object: 'chat.completion',
      model: 'gpt-4-0613',
      choices: [{
        message: {
          role: 'assistant',
          content: received_content,
        },
      }],
    };

    res.status(200).send(response); 

  } catch (error) {
    res.status(500).send(`Error: ${error}`);
  }
});

app.get('/v1/models', (req, res) => {
  const modelInfo = {
    object: 'list',
    data: [
      {
        id: 'gpt-4',
        object: 'model',
        created: Date.now(),
        owned_by: 'openai',
        permission: [],
        root: 'gpt-4',
        parent: null,
      },
    ],
    url: req.url,
  };

  res.json(modelInfo);
});

const port = 5004;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});