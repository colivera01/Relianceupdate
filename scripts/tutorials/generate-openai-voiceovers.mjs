import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

function readEnvValue(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  if (!existsSync(".env.local")) {
    return "";
  }

  const envFile = readFile(".env.local", "utf8");
  return envFile.then((contents) => {
    const line = contents
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));
    if (!line) {
      return "";
    }
    return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const tutorials = [
  {
    title: "How Service Videos and Reviews Work",
    scriptPath: "docs/tutorial-production/voiceover_scripts/tutorial_01_service_videos_reviews_human.txt",
    outputPath:
      "C:/Users/Cesar Olivera/Videos/Reliance Videos/01_how_service_videos_and_reviews_work/capcut_project/01_how_service_videos_and_reviews_work_voiceover_openai_nova_human.mp3",
  },
  {
    title: "How To Browse Vendor Services",
    scriptPath: "docs/tutorial-production/voiceover_scripts/tutorial_02_browse_services_human.txt",
    outputPath:
      "C:/Users/Cesar Olivera/Videos/Reliance Videos/02_how_to_browse_and_choose_services/capcut_project/tutorial_02_browse_services_voiceover_openai_nova_human.mp3",
  },
  {
    title: "How To Launch Your Vendor Profile",
    scriptPath: "docs/tutorial-production/voiceover_scripts/tutorial_03_vendor_profile_human.txt",
    outputPath:
      "C:/Users/Cesar Olivera/Videos/Reliance Videos/03_how_to_launch_your_vendor_profile/capcut_project/03_how_to_launch_your_vendor_profile_voiceover_openai_nova_human.mp3",
  },
];

const apiKey = await readEnvValue("OPENAI_API_KEY");
const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const voice = process.env.OPENAI_TTS_VOICE || "nova";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY was not found in the environment or .env.local.");
}

async function generateVoiceover({ title, scriptPath, outputPath }) {
  const input = await readFile(scriptPath, "utf8");
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      instructions:
        "Speak like a warm, helpful female onboarding guide. Natural pacing, not robotic. Use gentle emphasis on key Reliance terms. Pause briefly between ideas.",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI voiceover failed for "${title}": ${response.status} ${await response.text()}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  console.log(`Generated: ${title}`);
  console.log(`Saved to: ${outputPath}`);
}

for (const tutorial of tutorials) {
  await generateVoiceover(tutorial);
}

console.log("All OpenAI replacement voiceovers generated.");
