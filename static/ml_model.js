let historicalData = [];
let model;
let minPrice, maxPrice;

export async function initializeML(log, getTicker, getFigi) {
    log('Инициализация машинного обучения с TensorFlow.js...', 'info');

    model = tf.sequential();
    model.add(tf.layers.dense({ units: 20, inputShape: [1], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

    const ticker = getTicker();
    const figi = getFigi();
    if (ticker && figi) {
        await updateHistoricalData(ticker, figi, log);
    }

    setInterval(async () => {
        const currentTicker = getTicker();
        const currentFigi = getFigi();
        if (currentTicker && currentFigi) {
            await updateHistoricalData(currentTicker, currentFigi, log);
            await trainModel(log);
        }
    }, 60000);
}

async function updateHistoricalData(ticker, figi, log) {
    try {
        const response = await fetch(`/get_candles?ticker=${encodeURIComponent(ticker)}&figi=${encodeURIComponent(figi)}&timeframe=1m`);
        const data = await response.json();
        if (data.candles) {
            historicalData = data.candles.map(c => ({
                time: new Date(c.time).getTime(),
                close: c.close
            }));
            minPrice = Math.min(...historicalData.map(d => d.close));
            maxPrice = Math.max(...historicalData.map(d => d.close));
            log(`Обновлены исторические данные: ${historicalData.length} записей`, 'info');
            await trainModel(log);
        }
    } catch (error) {
        log(`Ошибка загрузки данных для ML: ${error.message}`, 'error');
    }
}

async function trainModel(log) {
    if (historicalData.length < 2) {
        log('Недостаточно данных для обучения модели', 'warn');
        return;
    }

    const xsRaw = historicalData.map((d, i) => [i]);
    const ysRaw = historicalData.map(d => [d.close]);
    const xs = tf.tensor2d(xsRaw, [historicalData.length, 1]);
    const ys = tf.tensor2d(ysRaw, [historicalData.length, 1]).sub(minPrice).div(maxPrice - minPrice);

    log('Начало обучения модели...', 'info');
    await model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: async (epoch, logs) => {
                if (epoch % 10 === 0) {
                    log(`Обучение модели: эпоха ${epoch}, ошибка ${logs.loss.toFixed(4)}`, 'info');
                }
            }
        }
    });

    const lastXs = tf.tensor2d(historicalData.slice(-10).map((d, i) => [i]), [10, 1]);
    const predictions = model.predict(lastXs).mul(maxPrice - minPrice).add(minPrice);
    const actual = tf.tensor2d(historicalData.slice(-10).map(d => [d.close]), [10, 1]);
    const mae = tf.metrics.meanAbsoluteError(actual, predictions).dataSync()[0];
    log(`Оценка точности модели: MAE = ${mae.toFixed(2)} ₽`, 'info');

    tf.dispose([xs, ys, lastXs, predictions, actual]);
}

export function getPrediction(ticker, figi, period) {
    if (historicalData.length < 2 || !model) {
        console.warn(`Недостаточно данных для предсказания: ${historicalData.length} < 2 или модель не готова`);
        return null;
    }

    if (maxPrice === minPrice) {
        console.error(`Ошибка нормализации: minPrice=${minPrice}, maxPrice=${maxPrice}, масштаб = 0`);
        return historicalData[historicalData.length - 1].close; // Возвращаем последнюю цену как fallback
    }

    const lastIndex = historicalData.length - 1;
    const inputTensor = tf.tensor2d([[lastIndex + 1]], [1, 1]);
    const predictionTensor = model.predict(inputTensor);
    const rawPrediction = predictionTensor.dataSync()[0];
    const scaledPrediction = rawPrediction * (maxPrice - minPrice) + minPrice;
    console.log(`Предсказание для ${ticker}: raw=${rawPrediction}, scaled=${scaledPrediction}, minPrice=${minPrice}, maxPrice=${maxPrice}`);
    
    tf.dispose([inputTensor, predictionTensor]);
    return scaledPrediction;
}