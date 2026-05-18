/* eslint-disable no-undef */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const appLatency = new Trend('app_latency', true);

const BASE = __ENV.BASE_URL || 'http://localhost';

// All deployed SvelteKit web apps with their ports
const apps = [
	{ name: 'dashboard', url: `${BASE}:5173` },
	{ name: 'chat', url: `${BASE}:3000` },
	{ name: 'todo', url: `${BASE}:5188` },
	{ name: 'quotes', url: `${BASE}:5185` },
	{ name: 'calendar', url: `${BASE}:5186` },
	{ name: 'clock', url: `${BASE}:5187` },
	{ name: 'contacts', url: `${BASE}:5176` },
	{ name: 'storage', url: `${BASE}:5178` },
	{ name: 'presi', url: `${BASE}:5180` },
	{ name: 'cards', url: `${BASE}:5181` },
	{ name: 'skilltree', url: `${BASE}:5183` },
	{ name: 'photos', url: `${BASE}:5184` },
	{ name: 'music', url: `${BASE}:5189` },
	{ name: 'picture', url: `${BASE}:5174` },
	{ name: 'inventory', url: `${BASE}:5191` },
];

// When testing against production, use subdomains
const prodApps = [
	{ name: 'dashboard', url: 'https://mana.how' },
	{ name: 'chat', url: 'https://chat.mana.how' },
	{ name: 'todo', url: 'https://todo.mana.how' },
	{ name: 'calendar', url: 'https://calendar.mana.how' },
	{ name: 'clock', url: 'https://clock.mana.how' },
];

export const options = {
	stages: [
		{ duration: '30s', target: 10 }, // Ramp up
		{ duration: '3m', target: 50 }, // Hold at 50 VUs
		{ duration: '30s', target: 0 }, // Ramp down
	],
	thresholds: {
		http_req_duration: ['p(95)<2000'], // 95% under 2s
		errors: ['rate<0.05'], // <5% errors
	},
};

export default function () {
	const targets = __ENV.BASE_URL?.startsWith('https') ? prodApps : apps;
	const app = targets[Math.floor(Math.random() * targets.length)];

	const res = http.get(app.url, {
		tags: { app: app.name },
		timeout: '10s',
	});

	const success = check(res, {
		'status is 200': (r) => r.status === 200,
		'response has body': (r) => r.body && r.body.length > 0,
		'response time < 2s': (r) => r.timings.duration < 2000,
	});

	errorRate.add(!success);
	appLatency.add(res.timings.duration, { app: app.name });

	sleep(Math.random() * 2 + 0.5); // 0.5-2.5s between requests
}
