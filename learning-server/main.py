from app.main import app, mcp


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000)
