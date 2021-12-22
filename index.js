import crypto from "crypto";
import {
    ApiClient,
    ApiClientInMemoryContextProvider,
} from "@northflank/js-client";

(async () => {
    const projectId = "growthbook";
    const region = process.env.NF_REGION || "us-central";
    const apiToken = process.env.NF_TOKEN;

    const resources = {
        web: "nf-compute-100-1",
        mongodb: "nf-compute-20",
    };
    const versions = {
        branch: "master",
        mongodb: "13.4.0",
    };

    const resourceNames = {
        web: "web",
        mongodb: "mongodb",
    };

    const contextProvider = new ApiClientInMemoryContextProvider();
    await contextProvider.addContext({
        name: "default",
        token: apiToken,
    });

    const apiClient = new ApiClient(contextProvider);

    await apiClient.create.project({
        data: {
            name: projectId,
            region,
        },
    });

    await apiClient.create.addon({
        parameters: {
            projectId,
        },
        data: {
            name: resourceNames.mongodb,
            type: "mongodb",
            version: versions.mongodb,
            billing: {
                deploymentPlan: resources.mongodb,
                storage: 8192,
                replicas: 1,
            },
        },
    });

    await apiClient.create.service.deployment({
        parameters: {
            projectId,
        },
        data: {
            name: resourceNames.web,
            billing: {
                deploymentPlan: resources.web,
            },
            deployment: {
                instances: 1,
                external: {
                    imagePath: "growthbook/growthbook:latest",
                },
            },
            ports: [
                {
                    name: "web",
                    internalPort: 3000,
                    public: true,
                    protocol: "HTTP",
                },
                {
                    name: "api",
                    internalPort: 3100,
                    public: true,
                    protocol: "HTTP",
                },
            ],
        },
    });

    const {
        data: { ports },
    } = await apiClient.get.service.ports({
        parameters: {
            projectId: projectId,
            serviceId: resourceNames.mongodb,
        },
    });

    const [APP_ORIGIN, API_HOST] = ports.map((p) => p.dns);

    await apiClient.create.secret({
        parameters: {
            projectId,
        },
        data: {
            name: "prod-secrets",
            description: "A description",
            secretType: "environment",
            priority: 10,
            addonDependencies: [
                {
                    addonId: resourceNames.mongodb,
                    keys: [
                        {
                            keyName: "MONGO_SRV",
                            aliases: ["MONGODB_URI"],
                        },
                    ],
                },
            ],
            data: {
                APP_ORIGIN: APP_ORIGIN,
                API_HOST: API_HOST,
                JWT_SECRET: crypto
                    .randomBytes(124)
                    .toString("base64")
                    .substring(0, length),
                ENCRYPTION_KEY: crypto
                    .randomBytes(124)
                    .toString("base64")
                    .substring(0, length),
                NODE_ENV: "production",
            },
        },
    });
})();
