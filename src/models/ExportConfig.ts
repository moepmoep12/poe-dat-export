interface ExportConfig {
  patch: string;
  files: string[];
  translations?: string[];
  tables: Array<{
    name: string;
    columns?: string[];
  }>;
}

export const config: ExportConfig = {
  patch: "3.19.2.1",
  files: ["data/Achievements.dat64"],
  tables: [
    {
      name: "WorldAreas",
    },
  ],
  translations: ["English"],
};
