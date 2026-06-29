import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY;
const requestedVoiceId = process.env.ELEVENLABS_VOICE_ID;
const requestedVoiceName = process.env.ELEVENLABS_VOICE_NAME || "Rachel";
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

const tutorials = [
  {
    title: "How Service Videos and Reviews Work",
    scriptPath: "docs/tutorial-production/voiceover_scripts/tutorial_01_service_videos_reviews_human.txt",
    outputPath:
      "C:/Users/Cesar Olivera/Videos/Reliance Videos/01_how_service_videos_and_reviews_work/capcut_project/01_how_service_videos_and_reviews_work_voiceover_elevenlabs_human.mp3",
  },
  {
    title: "How To Browse Vendor Services",
    scriptPath: "docs/tutorial-production/voiceover_scripts/tutorial_02_browse_services_human.txt",
    outputPath:
      "C:/Users/Cesar Olivera/Videos/Reliance Videos/02_how_to_browse_and_choose_services/capcut_project/tutorial_02_browse_services_proof_cards_voiceover_elevenlabs_human.mp3",
  },
  {
    title: "How To Launch Your Vendor Profile",
    scriptPath: "docs/tutorial-production/voiceover_scripts/tutorial_03_vendor_profile_human.txt",
    outputPath:
      "C:/Users/Cesar Olivera/Videos/Reliance Videos/03_how_to_launch_your_vendor_profile/capcut_project/03_how_to_launch_your_vendor_profile_voiceover_elevenlabs_human.mp3",
  },
];

if (!apiKey) {
  throw new Error(
    "Set ELEVENLABS_API_KEY before running this script. Example: $env:ELEVENLABS_API_KEY='paste-key-here'",
  );
}

async function resolveVoiceId() {
  if (requestedVoiceId) {
    return requestedVoiceId;
  }

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load ElevenLabs voices: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const voices = Array.isArray(data.voices) ? data.voices : [];
  const voice =
    voices.find((candidate) => candidate.name?.toLowerCase() === requestedVoiceName.toLowerCase()) ||
    voices.find((candidate) => candidate.name?.toLowerCase().includes(requestedVoiceName.toLowerCase()));

  if (!voice?.voice_id) {
    const availableNames = voices.map((candidate) => candidate.name).filter(Boolean).slice(0, 20).join(", ");
    throw new Error(
      `Could not find an ElevenLabs voice named "${requestedVoiceName}". Set ELEVENLABS_VOICE_ID or choose one of: ${availableNames}`,
    );
  }

  return voice.voice_id;
}

async function generateVoiceover({ title, scriptPath, outputPath }, voiceId) {
  const text = await readFile(scriptPath, "utf8");
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.82,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Voiceover failed for "${title}": ${response.status} ${await response.text()}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const audio = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, audio);
  console.log(`Generated: ${title}`);
  console.log(`Saved to: ${outputPath}`);
}

const voiceId = await resolveVoiceId();
console.log(`Using ElevenLabs voice ID: ${voiceId}`);

for (const tutorial of tutorials) {
  await generateVoiceover(tutorial, voiceId);
}

console.log("All replacement voiceovers generated. Import these MP3 files into CapCut and replace the Zira voice tracks.");
