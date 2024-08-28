import React, { useState, useEffect } from "react";
import axios from "axios";
import ForceGraph3D from "react-force-graph-3d";

// Set up Axios with the correct base URL for the backend
const api = axios.create({
  baseURL: "http://localhost:3001", // Directly specify your backend URL here
});

export function MainPage() {
  //@ts-ignore
  const [searchResult, setSearchResult] = useState<SearchResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [graphData, setGraphData] = useState<any>(null);

  const log = (message: string) => {
    console.log(`[Client Log] ${message}`);
  };

  const initializeDB = async () => {
    try {
      log("Initializing database...");
      setStatusMessage("Initializing database...");
      await api.post("/api/init", {}, {
        headers: {
          "Content-Type": "application/json",
        }
      });
      log("Database initialized successfully.");
      setStatusMessage("Database initialized successfully.");
    } catch (error) {
      log("Error initializing database.");
      setStatusMessage("Error initializing database.");
      console.error("Error initializing the database:", error);
    }
  };

  const handleSearch = async (searchQuery: string) => {
    try {
      log(`Initiating search for: "${searchQuery}"...`);
      setStatusMessage(`Searching for: "${searchQuery}"...`);
      const response = await api.post("/api/search", { query: searchQuery }, {
        headers: {
          "Content-Type": "application/json",
        }
      });
      setSearchResult(response.data.results);
      log(`Search completed for: "${searchQuery}".`);
      setStatusMessage(`Search completed for: "${searchQuery}".`);
    } catch (error) {
      log("Error performing search.");
      setStatusMessage("Error performing search.");
      console.error("Error performing search:", error);
    }
  };

  const performRandomTestSearch = async () => {
    log("Performing a random test search...");
    setStatusMessage("Performing a random test search...");
    const testQueries = [
      "founded DFINITY Foundation",
      "launched Mainnet",
      "uses WebAssembly",
      "supports ICP Tokens",
      "baseball"
    ];

    const randomQuery = testQueries[Math.floor(Math.random() * testQueries.length)];
    await handleSearch(randomQuery);
  };

  const handleInterwingle = async (type: string) => {
    try {
      log(`Applying Interwingle type: "${type}"...`);
      setStatusMessage(`Applying Interwingle type: "${type}"...`);
      const response = await api.post("/api/interwingle", { type });
      setGraphData(response.data.data);
      log(`Interwingle ${type} applied successfully.`);
      setStatusMessage(`Interwingle ${type} applied successfully.`);
    } catch (error) {
      log("Error applying Interwingle.");
      setStatusMessage("Error applying Interwingle.");
      console.error("Error applying Interwingle:", error);
    }
  };

  const fetchGraphData = async () => {
    try {
      log("Fetching graph data...");
      setStatusMessage("Fetching graph data...");
      const response = await api.post("/api/graph");
      setGraphData(response.data.data);
      log("Graph data fetched successfully.");
      setStatusMessage("Graph data fetched successfully.");
    } catch (error) {
      log("Error fetching graph data.");
      setStatusMessage("Error fetching graph data.");
      console.error("Error fetching graph data:", error);
    }
  };

  return (
    <div className="app">

      <div className="content">
        <div className="status">
          <h2>Status:</h2>
          <p>{statusMessage}</p>
        </div>

        <div className="actions">
          <h2>Initialization</h2>
          <button onClick={initializeDB}>Initialize Database</button>

          <h2>Random Search Test</h2>
          <button onClick={performRandomTestSearch}>Test Search</button>

          <h2>Interwingle Tests</h2>
          <button onClick={() => handleInterwingle("ISOLATED")}>Isolated</button>
          <button onClick={() => handleInterwingle("CONFLUENCE")}>Confluence</button>
          <button onClick={() => handleInterwingle("FUSION")}>Fusion</button>
          <button onClick={() => handleInterwingle("BRIDGE")}>Bridge</button>

          <h2>Graph Visualization</h2>
          <button onClick={fetchGraphData}>Display Graph Data</button>
        </div>

        <div className="results">
          <h2>Search Results:</h2>
          {searchResult.length > 0 ? (
            searchResult.map((result, index) => (
              <div key={index}>
                <p>
                  <strong>Match:</strong> {result.input} <br />
                  <strong>Distance:</strong> {result.distance} <br />
                  <strong>Metadata:</strong> {JSON.stringify(result.object)}
                </p>
              </div>
            ))
          ) : (
            <p>No results found</p>
          )}

          {graphData ? (
            <ForceGraph3D
              graphData={graphData}
              nodeAutoColorBy="group" // Automatically color nodes by group for visual distinction
              nodeOpacity={0.9} // Set node opacity for a more dynamic look
              nodeResolution={16} // Higher resolution for smoother node spheres
              nodeVal={node => node.importance || 1} // Scale node size by importance, default to 1 if undefined
              linkDirectionalParticles={4} // Add particles to links to show direction
              linkDirectionalParticleSpeed={0.006} // Set particle speed for smooth motion
              linkWidth={2} // Define link width for better visibility
              linkOpacity={0.5} // Slightly transparent links for better node visibility
              linkCurvature={0.25} // Add curvature to links for visual complexity
              linkDirectionalArrowLength={8} // Increase arrow length for clearer direction
              linkDirectionalArrowRelPos={1} // Position arrows at the end of the links
              backgroundColor="#000011" // Dark background for contrast
              showNavInfo={false} // Hide navigation info for a cleaner interface
              onNodeClick={node => alert(`Node clicked: ${node.id}`)} // Interaction: Show alert on node click
              nodeThreeObjectExtend={true} // Extend the default node with the custom sprite
            />
          ) : (
            <p>No graph data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
