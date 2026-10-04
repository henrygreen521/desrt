"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");

// Navigation bar elements
const navBar = document.getElementById("sj-nav-bar");
const urlDisplay = document.getElementById("sj-url-display");
const homeBtn = document.getElementById("sj-home-btn");
const backBtn = document.getElementById("sj-back-btn");
const reloadBtn = document.getElementById("sj-reload-btn");
const mainContent = document.getElementById("sj-main-content");

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

let currentFrame = null;
let urlUpdateInterval = null;

function updateURLDisplay(url) {
	try {
		const urlObj = new URL(url);
		const host = urlObj.hostname || "";
		const path = urlObj.pathname || "";
		const query = urlObj.search || "";
		urlDisplay.value = host + path + query;
	} catch (err) {
		urlDisplay.value = url;
	}
}

function startURLTracking() {
	if (urlUpdateInterval) clearInterval(urlUpdateInterval);

	urlUpdateInterval = setInterval(() => {
		if (!currentFrame || !currentFrame.frame) {
			clearInterval(urlUpdateInterval);
			return;
		}

		try {
			const href = currentFrame.frame.contentWindow.location.href;
			if (href && href !== "about:blank") {
				updateURLDisplay(href);
			}
		} catch (err) {
			// Cross-origin restriction; silently ignore
		}
	}, 500);
}

function stopURLTracking() {
	if (urlUpdateInterval) {
		clearInterval(urlUpdateInterval);
		urlUpdateInterval = null;
	}
}

form.addEventListener("submit", async (event) => {
	event.preventDefault();

	try {
		await registerSW();
	} catch (err) {
		error.textContent = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const url = search(address.value, searchEngine.value);

	let wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";
	if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);
	}

	// Hide main content, show frame
	mainContent.style.display = "none";

	const frame = scramjet.createFrame();
	frame.frame.id = "sj-frame";
	document.body.appendChild(frame.frame);
	currentFrame = frame;

	updateURLDisplay(url);
	startURLTracking();

	frame.go(url);
});

homeBtn.addEventListener("click", () => {
	stopURLTracking();

	if (currentFrame && currentFrame.frame && currentFrame.frame.parentNode) {
		currentFrame.frame.parentNode.removeChild(currentFrame.frame);
		currentFrame = null;
	}

	// Show main content again
	mainContent.style.display = "flex";
	address.value = "";
	urlDisplay.value = "about:blank";
	address.focus();
});

backBtn.addEventListener("click", () => {
	if (!currentFrame || !currentFrame.frame || !currentFrame.frame.contentWindow) return;

	try {
		currentFrame.frame.contentWindow.history.back();
	} catch (err) {
		console.error("Could not navigate back:", err);
	}
});

reloadBtn.addEventListener("click", () => {
	if (!currentFrame || !currentFrame.frame || !currentFrame.frame.contentWindow) return;

	try {
		currentFrame.frame.contentWindow.location.reload();
	} catch (err) {
		console.error("Could not reload:", err);
	}
});
