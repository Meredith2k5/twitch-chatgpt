const express = require('express')
const request = require('request')
const app = express()
const fs = require('fs');
const { promisify } = require('util')
const readFile = promisify(fs.readFile)

// load env variables
let GPT_MODE = process.env.GPT_MODE
let HISTORY_LENGTH = process.env.HISTORY_LENGTH
let OPENAI_API_KEY = process.env.OPENAI_API_KEY
let MODEL_NAME = process.env.MODEL_NAME
let mao_res = "wait ~25sec > !gpt?"
if (!GPT_MODE) {
    GPT_MODE = "CHAT"
}
if (!HISTORY_LENGTH) {
    HISTORY_LENGTH = 5
}
if (!OPENAI_API_KEY) {
    console.log("No OPENAI_API_KEY found. Please set it as environment variable.")
}
if (!MODEL_NAME) {
    MODEL_NAME = "gpt-3.5-turbo"
}

// init global variables
const MAX_LENGTH = 399
let file_context = "You are a helpful Twitch Chatbot."
let last_user_message = ""

const messages = [
    {role: "system", content: "You are a helpful Twitch Chatbot."}
];

app.use(express.json({extended: true, limit: '1mb'}))

app.all('/', (req, res) => {
    res.send('Yo!')
})

if (process.env.GPT_MODE === "CHAT"){

    fs.readFile("./file_context.txt", 'utf8', function(err, data) {
        if (err) throw err;
        messages[0].content = data;
    });

} else {

    fs.readFile("./file_context.txt", 'utf8', function(err, data) {
        if (err) throw err;
        file_context = data;
    });

}

app.get('/gpt/:text', async (req, res) => {

    //The agent should recieve Username:Message in the text to identify conversations with different users in his history. 

    const text = req.params.text
    const { Configuration, OpenAIApi } = require("openai");

    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const openai = new OpenAIApi(configuration);

    if (GPT_MODE === "CHAT"){
        //CHAT MODE EXECUTION

        //Add user message to  messages
        messages.push({role: "user", content: text})
        //Check if message history is exceeded
        if(messages.length > ((process.env.HISTORY_LENGTH * 2) + 1)) {
            messages.splice(1,2)
        }

        console.dir(messages)

        const response = await openai.createChatCompletion({
            model: MODEL_NAME,
            messages: messages,
            temperature: 0.7,
            max_tokens: 256,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        if (response.data.choices) {
            let agent_response = response.data.choices[0].message.content
            messages.push({role: "assistant", content: agent_response})
            
            //Check for Twitch max. chat message length limit and slice if needed
            let sliced_agent_response = ""
            if(agent_response.length > MAX_LENGTH){
                sliced_agent_response = agent_response.slice(0, MAX_LENGTH)
                // save the other part of the message for the next response
                last_user_message = agent_response.slice(MAX_LENGTH)
            } else {
                sliced_agent_response = agent_response
            }
            mao_res = sliced_agent_response
            res.send(sliced_agent_response)
        } else {
            res.send("Something went wrong. Try again later!")
        }

    } else {
        //PROMPT MODE EXECUTION
        const prompt = file_context + "\n\nQ:" + text + "\nA:";
        
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            temperature: 0.7,
            max_tokens: 256,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        if (response.data.choices) {
            let agent_response = response.data.choices[0].text

            //Check for Twitch max. chat message length limit and slice if needed
            let sliced_agent_response = ""
            if(agent_response.length > MAX_LENGTH){
                sliced_agent_response = agent_response.slice(0, MAX_LENGTH)
                // save the other part of the message for the next response
                last_user_message = agent_response.slice(MAX_LENGTH)
            } else {
                sliced_agent_response = agent_response
            }
            mao_res = sliced_agent_response
            res.send(sliced_agent_response)
        } else {
            res.send("Something went wrong. Try again later!")
        }
    }

})

app.all('/aa/', (req, res) => {
        res.send(mao_res)
})
app.all('/continue/', (req, res) => {
    // Return the rest of the sliced answer from the last request
    if (last_user_message.length > 0) {
        let new_user_message = last_user_message
        if (last_user_message.length > MAX_LENGTH){
            new_user_message = last_user_message.slice(0, MAX_LENGTH)
        }
        // save the other part of the message for the next response
        last_user_message = last_user_message.slice(MAX_LENGTH)
        mao_res = new_user_message
        res.send(new_user_message)
    }
    else {
        res.send("No message to continue.")
    }
})

app.listen(process.env.PORT || 3000)
