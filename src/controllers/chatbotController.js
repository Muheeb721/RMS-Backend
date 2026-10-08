export const handlemessage = async (req, res) => {
  try {
    const { message, session_id } = req.body;

    const response = await fetch('http://127.0.0.1:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session_id || 'default-session',
        message: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const data = await response.json();
    res.json({ reply: data.reply });
  } catch (error) {
    console.error('Chatbot message handling failed', error);
    res.status(500).json({ success: false, message: 'Unable to process chatbot message.' });
  }
};