import axios from "axios";

const API_URL = axios.create({
  baseURL: "http://localhost:5000/api",
});

export { API_URL };
