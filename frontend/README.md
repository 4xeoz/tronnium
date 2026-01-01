## Tronnium Frontend

This package contains the Next.js UI for Tronnium. It ships with Tailwind CSS 4 and talks to the Express backend that lives in `../backend`.

## Prerequisites

- Node.js 20+
- The Tronnium backend running locally (`npm install && npm run dev` inside `../backend`).

## Local Development

1. Install dependencies:

	```bash
	npm install
	```

2. Copy the environment template and adjust if your backend runs elsewhere:

	```bash
	cp .env.local.example .env.local
	```

3. Start the dev server (defaults to [http://localhost:3000](http://localhost:3000)):

	```bash
	npm run dev
	```

The home page shows the current health information retrieved from the backend at the URL defined in `NEXT_PUBLIC_BACKEND_URL`.

## Building for Production

```bash
npm run build
npm run start
```

## Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS 4 Documentation](https://tailwindcss.com)
