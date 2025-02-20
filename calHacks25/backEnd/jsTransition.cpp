#include <iostream>
#include "httplib.h"
#include "nlohmann/json.hpp"

using json = nlohmann::json;
using namespace httplib;

void handle_click(const Request& req, Response& res) {
    try {
        json data = json::parse(req.body);
        std::string continent = data["continent"];
        
        std::cout << "Continent Clicked: " << continent << std::endl;

        // Trigger another task based on the clicked continent
        if (continent == "Africa") {
            std::cout << "Loading Africa data..." << std::endl;
            // Call a function to load Africa-specific data
        }
        
        res.set_content("Click received", "text/plain");
    } catch (...) {
        res.set_content("Invalid request", "text/plain");
    }
}

int main() {
    Server svr;

    svr.Post("/click", handle_click);

    std::cout << "Server listening on port 5001..." << std::endl;
    if (!svr.listen("0.0.0.0", 5001)) {
        std::cerr << "Error: Unable to start server!" << std::endl;
        return -1;
    }
}