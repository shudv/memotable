import { Table } from "./Table";
import { toString } from "./TableUtilities";

describe("TableUtilities", () => {
    test("toString", () => {
        type Location = {
            id: string;
            country: string;
            region: string;
            city: string;
            district: string;
            population: number;
        };

        const table = new Table<string, Location>();
        const locationsData: [string, string, string, string, string, number][] = [
            // USA
            ["1", "USA", "West", "San Francisco", "Mission", 50000],
            ["2", "USA", "West", "San Francisco", "SOMA", 30000],
            ["3", "USA", "West", "Los Angeles", "Downtown", 60000],
            ["4", "USA", "West", "Seattle", "Capitol Hill", 40000],
            ["5", "USA", "East", "New York", "Manhattan", 100000],
            ["6", "USA", "East", "New York", "Brooklyn", 80000],
            ["7", "USA", "East", "Boston", "Back Bay", 35000],
            // Canada
            ["8", "Canada", "West", "Vancouver", "Downtown", 45000],
            ["9", "Canada", "West", "Vancouver", "Gastown", 25000],
            ["10", "Canada", "West", "Victoria", "Inner Harbour", 20000],
            ["11", "Canada", "East", "Toronto", "Downtown", 90000],
            ["12", "Canada", "East", "Toronto", "Yorkville", 40000],
            ["13", "Canada", "East", "Montreal", "Old Montreal", 50000],
            // UK
            ["14", "UK", "South", "London", "Westminster", 70000],
            ["15", "UK", "South", "London", "Camden", 55000],
            ["16", "UK", "South", "Brighton", "North Laine", 30000],
            ["17", "UK", "North", "Manchester", "Northern Quarter", 45000],
            ["18", "UK", "North", "Edinburgh", "Old Town", 40000],
            // Germany
            ["19", "Germany", "South", "Munich", "Altstadt", 60000],
            ["20", "Germany", "North", "Berlin", "Mitte", 80000],
            // India
            ["21", "India", "North", "Delhi", "Connaught Place", 120000],
            ["22", "India", "North", "Delhi", "Karol Bagh", 95000],
            ["23", "India", "North", "Chandigarh", "Sector 17", 55000],
            ["24", "India", "West", "Mumbai", "Colaba", 110000],
            ["25", "India", "West", "Mumbai", "Bandra", 85000],
            ["26", "India", "West", "Pune", "Koregaon Park", 65000],
            ["27", "India", "South", "Bangalore", "Indiranagar", 105000],
            ["28", "India", "South", "Bangalore", "Koramangala", 90000],
            ["29", "India", "South", "Chennai", "T Nagar", 75000],
            ["30", "India", "East", "Kolkata", "Park Street", 88000],
            ["31", "India", "East", "Kolkata", "Salt Lake", 70000],
        ];

        const locations: Location[] = locationsData.map(
            ([id, country, region, city, district, population]) => ({
                id,
                country,
                region,
                city,
                district,
                population,
            }),
        );

        // Add all locations
        for (const loc of locations) {
            table.set(loc.id, loc);
        }

        // Define multi-level hierarchical partitioning
        table.index(
            () => ["nested", "byCountry", "byCity"], // 3 top level partitions
            (name, partition) => {
                switch (name) {
                    case "nested":
                        partition.index(
                            // Nested level 1: Index by country
                            (l) => l.country,
                            (_, country) => {
                                // Nested level 2: Within each country, index by region
                                country.index(
                                    (l) => l.region,
                                    (_, region) => {
                                        // Nested level 3: Within each region, index by city
                                        region.index(
                                            (l) => l.city,
                                            (_, city) => {
                                                // Sort each city partition by population
                                                city.sort((a, b) => b.population - a.population);
                                            },
                                        );
                                    },
                                );
                            },
                        );
                        break;
                    case "byCountry":
                        partition.index(
                            (l) => l.country,
                            (countryName, country) => {
                                // Sort each country partition by population
                                country.sort((a, b) => b.population - a.population);

                                // IMPORTANT: Memoize only (large + frequently read) partitions
                                if (countryName === "India" || countryName === "USA") {
                                    country.memo();
                                }
                            },
                        );
                        break;
                    case "byCity":
                        partition.index(
                            (l) => l.city,
                            (_, city) => {
                                // Sort each city partition by name
                                city.sort((a, b) => a.city.localeCompare(b.city));
                            },
                        );
                        break;
                }
            },
        );

        // Print the full tree structure
        expect(
            toString(
                table,
                (location) => `${location.district} (${location.population})`,
                "🌍 World",
            ),
        ).toMatchSnapshot();
    });
});
