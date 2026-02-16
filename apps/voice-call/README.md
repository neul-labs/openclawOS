# Voice Call App (Twilio)

OpenClawOS plugin app for voice call handling via Twilio.

## Overview

This app provides voice call capabilities through Twilio's API, allowing OpenClawOS to:
- Initiate voice calls to phone numbers
- Hang up active calls
- Transfer calls to other numbers

## Installation

```bash
npm install
npm run build
```

## Configuration

Configure the app in your OpenClawOS config file:

```yaml
voice-call:
  twilioAccountSid: "your_account_sid"
  twilioAuthToken: "your_auth_token"
  twilioPhoneNumber: "+1234567890"  # Optional default number
```

### Configuration Options

- `twilioAccountSid` (required): Your Twilio Account SID from the Twilio Console
- `twilioAuthToken` (required): Your Twilio Auth Token from the Twilio Console
- `twilioPhoneNumber` (optional): Default Twilio phone number in E.164 format (e.g., +1234567890)

## Tools Provided

### `voice_call`

Initiate a voice call to a phone number using Twilio.

**Parameters:**
- `to` (string, required): The phone number to call (E.164 format, e.g., +1234567890)
- `from` (string, optional): The Twilio phone number to call from (uses config default if not specified)
- `message` (string, required): The message to speak during the call (text-to-speech)

**Example:**
```json
{
  "to": "+1234567890",
  "message": "Hello, this is a test call from OpenClawOS"
}
```

### `voice_hangup`

Hang up an active voice call.

**Parameters:**
- `callSid` (string, required): The Twilio Call SID to hang up

**Example:**
```json
{
  "callSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### `voice_transfer`

Transfer an active voice call to another number.

**Parameters:**
- `callSid` (string, required): The Twilio Call SID to transfer
- `to` (string, required): The phone number to transfer to (E.164 format)

**Example:**
```json
{
  "callSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "to": "+1234567890"
}
```

## Implementation Status

Currently, this app provides placeholder implementations for all three tools. The actual Twilio API integration needs to be implemented.

### TODO

- [ ] Implement actual Twilio REST API client
- [ ] Add proper authentication with Twilio
- [ ] Implement real call initiation
- [ ] Implement real call hangup
- [ ] Implement real call transfer
- [ ] Add error handling for Twilio API errors
- [ ] Add call status tracking
- [ ] Add webhook support for call events
- [ ] Add support for recording calls
- [ ] Add support for call conferencing

## Development

```bash
# Build the app
npm run build

# Type check
npm run typecheck

# Start the app
npm start
```

## Migration from Extension

This app replaces the deprecated `@openclaw/voice-call` extension. If you're migrating from the extension:

1. Update your config to use the new `voice-call` namespace instead of `extensions.voice-call`
2. Update any references to the old extension package name
3. The tool names remain the same (`voice_call`, `voice_hangup`, `voice_transfer`)

## License

MIT
