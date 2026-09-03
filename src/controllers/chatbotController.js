export const handlemessage = async (req, res) => {
  try {
    const { message } = req.body;

    let ai;
    try {
      const mod = await import('@google/GenI.js');
      const { googleGenI } = mod;
      ai = googleGenI({ apiKey: process.env.GENI_API_KEY });
    } catch (importErr) {
      console.warn('GenI client not available:', importErr.message || importErr);
      res.status(503).json({ success: false, message: 'AI service not configured.' });
      return;
    }

    const response = await ai.models.generatecontent({
      model: 'gemini-1.5-flash',
      contents: message,
    });
    res.json({ reply: response.text });
  } catch (error) {
    console.error('Chatbot message handling failed', error);
    res.status(500).json({ success: false, message: 'Unable to process chatbot message.' });
  }
};
