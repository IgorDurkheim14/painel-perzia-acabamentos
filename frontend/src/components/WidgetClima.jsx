import { useEffect, useState } from 'react';
import { getWeather } from '../services/api.js';

function weatherIcon(condition) {
  if (condition === 'Ensolarado') return '☀';
  if (condition === 'Chuva') return '☂';
  return '☁';
}

export default function WidgetClima() {
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState('goiania');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getWeather()
      .then((data) => { if (active) setCities(Array.isArray(data?.cidades) ? data.cidades : []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const city = cities.find((item) => item.id === cityId) || cities[0];

  return <div className="weather-widget" aria-live="polite">
    <span className="weather-icon" aria-hidden="true">{city ? weatherIcon(city.condicao) : '◌'}</span>
    <div className="weather-reading">
      <strong>{loading ? '—' : error || !city ? '--°' : `${Math.round(city.temperatura)}°`}</strong>
      <small>{error ? 'Clima indisponível' : city ? `${city.condicao} · ${city.umidade}% umidade` : 'Clima atual'}</small>
    </div>
    <label className="weather-city-label">
      <span className="visually-hidden">Selecionar cidade do clima</span>
      <select aria-label="Selecionar cidade do clima" value={city?.id || cityId} onChange={(event) => setCityId(event.target.value)} disabled={!cities.length}>
        {cities.length === 0 && <option value="goiania">Goiânia</option>}
        {(Array.isArray(cities) ? cities : []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
      </select>
    </label>
  </div>;
}
