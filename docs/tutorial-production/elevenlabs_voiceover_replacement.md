# Reliance Tutorial Voiceover Replacement

The first tutorial exports use Windows Zira narration, which sounds too robotic for first-time onboarding. Keep the screen recordings and replace only the voice track.

## Recommended Voice Direction

- Female voice
- Warm and calm
- Conversational, not announcer-style
- Medium-slow pacing
- Slight emphasis on Reliance terms like service record, public service video, customer reviews, and Trust Score

## Generate Human Voiceovers

Set your ElevenLabs API key for the current PowerShell session only. Do not save it in the repo.

```powershell
$env:ELEVENLABS_API_KEY="paste-key-here"
$env:ELEVENLABS_VOICE_NAME="Rachel"
node scripts/tutorials/generate-elevenlabs-voiceovers.mjs
```

If the account does not have a voice named Rachel, set the exact voice ID instead:

```powershell
$env:ELEVENLABS_API_KEY="paste-key-here"
$env:ELEVENLABS_VOICE_ID="paste-voice-id-here"
node scripts/tutorials/generate-elevenlabs-voiceovers.mjs
```

## Output Files

- `C:\Users\Cesar Olivera\Videos\Reliance Videos\01_how_service_videos_and_reviews_work\capcut_project\01_how_service_videos_and_reviews_work_voiceover_elevenlabs_human.mp3`
- `C:\Users\Cesar Olivera\Videos\Reliance Videos\02_how_to_browse_and_choose_services\capcut_project\tutorial_02_browse_services_proof_cards_voiceover_elevenlabs_human.mp3`
- `C:\Users\Cesar Olivera\Videos\Reliance Videos\03_how_to_launch_your_vendor_profile\capcut_project\03_how_to_launch_your_vendor_profile_voiceover_elevenlabs_human.mp3`

## CapCut Replacement Steps

1. Open each existing CapCut project.
2. Mute or remove the Zira voiceover track.
3. Import the matching ElevenLabs MP3.
4. Align the first spoken word with the first walkthrough moment.
5. Keep captions, but adjust timing if the new voice pauses differently.
6. Export replacement files with `_human_voice` in the filename.

## Suggested Export Names

- `tutorial_01_service_videos_reviews_human_voice_2026-06-21.mp4`
- `tutorial_02_browse_services_human_voice_2026-06-21.mp4`
- `tutorial_03_launch_vendor_profile_human_voice_2026-06-21.mp4`

## Notes

The script uses ElevenLabs Text to Speech and voice listing APIs. It does not store the API key, does not modify app source behavior, and does not overwrite the existing finished videos.

## OpenAI Fallback Used For Immediate Review

If ElevenLabs is not configured yet, generate warmer replacement audio with the existing OpenAI API key:

```powershell
node scripts/tutorials/generate-openai-voiceovers.mjs
```

Default output voice is `nova`. To try a different OpenAI voice:

```powershell
$env:OPENAI_TTS_VOICE="coral"
node scripts/tutorials/generate-openai-voiceovers.mjs
```

OpenAI replacement outputs:

- `C:\Users\Cesar Olivera\Videos\Reliance Videos\01_how_service_videos_and_reviews_work\capcut_project\01_how_service_videos_and_reviews_work_voiceover_openai_nova_human.mp3`
- `C:\Users\Cesar Olivera\Videos\Reliance Videos\02_how_to_browse_and_choose_services\capcut_project\tutorial_02_browse_services_voiceover_openai_nova_human.mp3`
- `C:\Users\Cesar Olivera\Videos\Reliance Videos\03_how_to_launch_your_vendor_profile\capcut_project\03_how_to_launch_your_vendor_profile_voiceover_openai_nova_human.mp3`
