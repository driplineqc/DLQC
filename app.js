const CONFIG = {
    rates: { cnyToUsd: 0.139 },
    superbuy: {
        pricePer500g: 8.87,
        fixedClearanceUsd: 8.56,
        couponDiscountUsd: 1.59,
        agentFeeMultiplier: 1.03
    }
};

const update = () => {
    const buyPrice = parseFloat(document.getElementById('buyPrice').value) || 0;
    const currency = document.getElementById('buyCurrency').value;
    const weightInput = parseFloat(document.getElementById('weight').value) || 0;
    const weightUnit = document.getElementById('weightUnit').value;
    const margin = parseFloat(document.getElementById('marginRange').value) / 100;
    const currentUsdRate = parseFloat(document.getElementById('usdRate').value) || 1.38;

    const weightGrams = weightUnit === 'kg' ? weightInput * 1000 : weightInput;

    const buyUsd = (currency === 'CNY' ? buyPrice * CONFIG.rates.cnyToUsd : buyPrice) * CONFIG.superbuy.agentFeeMultiplier;
    const buyCad = buyUsd * currentUsdRate;

    const nbTranches = Math.ceil(weightGrams / 500) || 1;
    const shipUsd = (nbTranches * CONFIG.superbuy.pricePer500g) + CONFIG.superbuy.fixedClearanceUsd - CONFIG.superbuy.couponDiscountUsd;
    const shipCad = shipUsd * currentUsdRate;

    const totalCad = buyCad + shipCad;
    const salePrice = margin < 1 ? totalCad / (1 - margin) : totalCad * 2;
    const totalProfit = salePrice - totalCad;

    document.getElementById('marginLabel').textContent = Math.round(margin * 100);
    document.getElementById('shipCad').textContent = shipCad.toFixed(2);
    document.getElementById('shipUsd').textContent = shipUsd.toFixed(2);
    document.getElementById('shipCalcDetails').textContent = `${nbTranches} tranche(s) de 500g + frais fixes`;
    document.getElementById('totalCad').textContent = totalCad.toFixed(2);
    document.getElementById('totalUsd').textContent = (buyUsd + shipUsd).toFixed(2);
    document.getElementById('salePrice').textContent = salePrice.toFixed(2);
    document.getElementById('profitTag').textContent = `+${totalProfit.toFixed(2)}$ Net`;
    document.getElementById('shareAmount').textContent = (totalProfit / 3).toFixed(2);
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
    update();
});