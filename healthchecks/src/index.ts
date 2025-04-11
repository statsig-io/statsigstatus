import axios from "axios";

// test page: https://manage.statuspage.io/pages/39vm41nlcwvr/incidents
const PAGE_ID = "39vm41nlcwvr";

// SECRETS expected as environment variables
const STATUSPAGE_API_KEY = process.env.STATUSPAGE_API_KEY;
if (!STATUSPAGE_API_KEY) {
  console.error("STATUSPAGE_API_KEY is not set.");
  process.exit(1);
}
const CLIENT_SDK_KEY = process.env.CLIENT_SDK_KEY;
if (!CLIENT_SDK_KEY) {
  console.error("CLIENT_SDK_KEY is not set.");
  process.exit(1);
}

type ComponentConfig = {
  name: string;
  id: string;
  hcURL: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string;
};

// https://manage.statuspage.io/pages/39vm41nlcwvr/components
const components: ComponentConfig[] = [
  {
    name: "Console",
    id: "n333xklq1qf1",
    hcURL: "https://console.statsig.com",
  },
  {
    name: "Docs",
    id: "t9rcbplldghy",
    hcURL: "https://docs.statsig.com",
  },
  {
    name: "WWW",
    id: "tgch4tvhtx7t",
    hcURL: "https://www.statsig.com",
  },
  {
    name: "Event Ingestion",
    id: "5jyxsm3xww8q",
    hcURL: "https://api.statsig.com/v1/log_event",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "STATSIG-API-KEY": CLIENT_SDK_KEY,
    },
    data: JSON.stringify({
      events: [
        {
          eventName: "",
        },
      ],
    }),
  },
  {
    name: "Server Configuration",
    id: "7fs2xb1ydvlt",
    hcURL: "https://api.statsig.com/_statsig/ready",
  },
  {
    name: "Client Configuration",
    id: "fr8htqzmbtp2",
    hcURL: "https://api.statsig.com/_statsig/ready",
  },
];

enum ComponentStatus {
  OPERATIONAL = "operational",
  MAJOR_OUTAGE = "major_outage",
}

async function updateComponentStatus(
  component: ComponentConfig,
  status: ComponentStatus
) {
  try {
    const componentURL = `https://api.statuspage.io/v1/pages/${PAGE_ID}/components/${component.id}`;
    const postRes = await axios.patch(
      componentURL,
      {
        component: {
          status: status,
        },
      },
      {
        headers: {
          Authorization: `OAuth ${STATUSPAGE_API_KEY}`,
        },
      }
    );
    console.log(
      `Updating component status to ${status} for ${component.name} succeeded: ${postRes.status}`
    );
  } catch (postErr) {
    console.error(
      `Updating component status to ${status} for ${component.name} failed: ${
        (postErr as Error).message
      }`
    );
  }
}

async function checkComponentHealth(
  component: ComponentConfig
): Promise<boolean> {
  try {
    const requestConfig = {
      method: component.method ?? "GET",
      url: component.hcURL,
      ...(component.method === "POST" &&
        component.headers && { headers: component.headers }),
      ...(component.method === "POST" &&
        component.data && {
          data: component.data,
        }),
    };
    const response = await axios(requestConfig);
    console.log(
      `Health check ${requestConfig.method} request for component ${component.name} succeeded: ${response.status}`
    );
    return true;
  } catch (error) {
    console.error(
      `Health check for component ${component.name} failed: ${
        (error as Error).message
      }`
    );
    return false;
  }
}

const run = async () => {
  try {
    await Promise.all(
      components.map(async (component) => {
        const isHealthy = await checkComponentHealth(component);
        const status = isHealthy
          ? ComponentStatus.OPERATIONAL
          : ComponentStatus.MAJOR_OUTAGE;
        await updateComponentStatus(component, status);
      })
    );
    console.log("All components processed successfully.");
  } catch (error) {
    console.error(`Error processing components: ${(error as Error).message}`);
  }
};

run();
