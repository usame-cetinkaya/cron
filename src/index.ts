export default {
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(handleSchedule(controller, env));
	},
} satisfies ExportedHandler<Env>;

async function handleSchedule(controller: ScheduledController, env: Env) {
	console.log(`Cron started at ${new Date().toISOString()}`);

	const date = new Date(controller.scheduledTime);
	const envKeys = Object.keys(env) as (keyof Env)[];
	const urls = envKeys.filter((key: string) => key.endsWith("_URL"));

	await Promise.allSettled(
		urls.map((key: string) => {
			const _env = env as Record<string, string>;
			const project = key.replace("_URL", "");
			const url = _env[key];
			const secret = _env[`${project}_SECRET`];
			const bypass = _env[`${project}_BYPASS`];
			const minutes = parseInt(_env[`${project}_MINUTES`], 10);

			if (!secret) {
				console.error(`${project}: Missing SECRET environment variable`);
				return Promise.reject();
			}

			if (!bypass) {
				console.error(`${project}: Missing BYPASS environment variable`);
				return Promise.reject();
			}

			if (isNaN(minutes)) {
				console.error(
					`${project}: Invalid or missing MINUTES environment variable`,
				);
				return Promise.reject();
			}

			if (date.getMinutes() % minutes !== 0) {
				console.log(
					`${project}: Current minute ${date.getMinutes()} is not a multiple of ${minutes}`,
				);
				return Promise.reject();
			}

			return pingProjectCron(project, url, secret, bypass);
		}),
	);
}

async function pingProjectCron(
	project: string,
	url: string,
	secret: string,
	bypass: string,
) {
	try {
		const res = await fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${secret}`,
				"x-vercel-protection-bypass": bypass,
			},
		});

		if (!res.ok) {
			console.error(`${project}: Request failed`);
		} else {
			console.log(`${project}: Request succeeded`);
		}
	} catch (err) {
		console.error(`${project}: Request error`, err);
	}
}
