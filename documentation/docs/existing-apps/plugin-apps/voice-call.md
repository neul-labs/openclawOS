# Voice Call Plugin

Twilio integration for voice call handling.

## Overview

| Property | Value                       |
| -------- | --------------------------- |
| Package  | `@openclawos/voice-call`    |
| Provider | Twilio                      |
| Features | Inbound/outbound calls, TTS |
| Status   | Beta                        |

## Quick Start

### 1. Set Up Twilio

1. Create a [Twilio account](https://www.twilio.com/)
2. Get a phone number
3. Note your Account SID and Auth Token

### 2. Configure

```json
{
  "apps": {
    "@openclawos/voice-call": {
      "enabled": true,
      "twilioAccountSid": "AC...",
      "twilioAuthToken": "...",
      "twilioPhoneNumber": "+1234567890"
    }
  }
}
```

### 3. Configure Webhook

In Twilio Console, set the voice webhook URL to:

```
https://your-domain.com/api/voice/webhook
```

### 4. Start

```bash
openclaw gateway
```

## Configuration

### Basic

```json
{
  "apps": {
    "@openclawos/voice-call": {
      "enabled": true,
      "twilioAccountSid": "AC...",
      "twilioAuthToken": "...",
      "twilioPhoneNumber": "+1234567890"
    }
  }
}
```

### Full Options

```json
{
  "apps": {
    "@openclawos/voice-call": {
      "enabled": true,
      "twilioAccountSid": "AC...",
      "twilioAuthToken": "...",
      "twilioPhoneNumber": "+1234567890",
      "voice": "alice",
      "language": "en-US",
      "speechModel": "phone_call",
      "recordCalls": false,
      "maxCallDuration": 600
    }
  }
}
```

| Option              | Type    | Description                   |
| ------------------- | ------- | ----------------------------- |
| `twilioAccountSid`  | string  | Twilio Account SID            |
| `twilioAuthToken`   | string  | Twilio Auth Token             |
| `twilioPhoneNumber` | string  | Your Twilio phone number      |
| `voice`             | string  | TTS voice (alice, man, woman) |
| `language`          | string  | Language code                 |
| `speechModel`       | string  | Speech recognition model      |
| `recordCalls`       | boolean | Record call audio             |
| `maxCallDuration`   | number  | Max call length (seconds)     |

## Features

### Inbound Calls

When someone calls your Twilio number:

1. Twilio sends webhook to OpenClawOS
2. App creates voice session
3. Agent handles conversation via STT/TTS
4. Call ends when complete

### Outbound Calls

Agent can initiate calls:

```
User: Call +1234567890 and remind them about the meeting
Agent: I'll call them now.
[Initiating call to +1234567890]
```

### Speech Recognition

Uses Twilio's speech recognition for:

- Real-time transcription
- Voice activity detection
- Silence handling

### Text-to-Speech

Agent responses are spoken using Twilio's TTS:

- Multiple voice options
- Language support
- SSML for advanced control

## Session Keys

Format: `voice:{call_sid}`

Example: `voice:CA1234567890abcdef`

## Agent Tools

### voice_call

Make an outbound call:

```typescript
{
  name: "voice_call",
  parameters: {
    to: "+1234567890",
    message: "Hello, this is a reminder..."
  }
}
```

### voice_hangup

End current call:

```typescript
{
  name: "voice_hangup";
}
```

### voice_transfer

Transfer to another number:

```typescript
{
  name: "voice_transfer",
  parameters: {
    to: "+1987654321"
  }
}
```

## Webhook Endpoints

### POST /api/voice/webhook

Twilio voice webhook for incoming calls.

### POST /api/voice/status

Call status callback.

### POST /api/voice/gather

Speech recognition results.

## Security

### Webhook Validation

All webhooks validate Twilio signatures:

```typescript
const valid = twilio.validateRequest(authToken, signature, url, params);
```

### Auth Token Protection

Never expose your auth token. Use environment variables:

```bash
export TWILIO_AUTH_TOKEN=your_token
```

## Example Flow

```
1. User calls +1234567890
2. Twilio POSTs to /api/voice/webhook
3. App responds with TwiML:
   <Response>
     <Say>Hello, I'm your AI assistant.</Say>
     <Gather input="speech" timeout="5">
       <Say>How can I help you?</Say>
     </Gather>
   </Response>
4. User speaks: "What's the weather?"
5. Twilio transcribes and POSTs to /api/voice/gather
6. Agent processes and responds
7. App returns TwiML with response
8. Repeat until call ends
```

## Troubleshooting

### Calls not connecting

1. Verify Twilio credentials
2. Check webhook URL is accessible
3. Verify phone number is active

### Speech not recognized

1. Check speech model setting
2. Verify language matches caller
3. Increase timeout if needed

### TTS sounds wrong

1. Try different voice option
2. Check language setting
3. Use SSML for better control

## Next Steps

- [Diagnostics Plugin](diagnostics.md)
- [Twilio Documentation](https://www.twilio.com/docs/voice)
