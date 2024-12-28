// pages/api/generate.js
import Replicate from 'replicate';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable();
    const [fields, files] = await form.parse(req);
    const text = fields.text[0];
    const templateId = fields.templateId?.[0];
    const image = files.image?.[0];

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    let imageBuffer;
    let mimetype = 'image/jpeg';

    if (image) {
      // Handle uploaded image
      imageBuffer = fs.readFileSync(image.filepath);
      mimetype = image.mimetype;
    } else if (templateId) {
      // Handle template selection
      const templatePath = path.join(process.cwd(), 'public', 'templates', `${templateId}.jpg`);
      imageBuffer = fs.readFileSync(templatePath);
    }

    if (!imageBuffer) {
      return res.status(400).json({ error: 'Either an image or template must be provided' });
    }

    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:${mimetype};base64,${base64Image}`;

    const output = await replicate.run(
      "justmalhar/flux-thumbnails-v2:be1f9d9a43c18c9c0d8c9024d285aa5fa343914648a7fe35be291ed04a9dfeb0",
      {
        input: {
          model: "dev",
          prompt: `a youtube thumbnail in the style of YTTHUMBNAIL, and the exact text: "${text}" prominently displayed in perfectly legible big bold contrasting letters over the image, while ensuring the "${text}" is the main focal point in the foreground`,
          lora_scale: 1,
          num_outputs: 4,
          aspect_ratio: "16:9",
          output_format: "png",
          guidance_scale: 3.5,
          output_quality: 100,
          prompt_strength: 0.9,
          num_inference_steps: 50,
          image: imageUrl
        },
      }
    );

    // Clean up the temporary file if it exists
    if (image && image.filepath) {
      fs.unlinkSync(image.filepath);
    }

    return res.status(200).json({ output });
  } catch (error) {
    console.error('Error generating thumbnails:', error);
    return res.status(500).json({ error: 'Failed to generate thumbnails' });
  }
}