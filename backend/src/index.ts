
import app from './app';
import dotenv from 'dotenv';


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`MoneyWing API server running on port ${PORT}`);
});

