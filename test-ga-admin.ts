import { googleApiFetch } from './layers/narduk-nuxt-layer/server/utils/google.ts';

async function main() {
  try {
    const res = await googleApiFetch(
      'https://analyticsadmin.googleapis.com/v1beta/properties/526067189/dataStreams',
      ['https://www.googleapis.com/auth/analytics.readonly']
    );
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
