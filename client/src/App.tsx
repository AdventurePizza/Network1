// @ts-nocheck
import "./App.css";
import React, { useEffect, useState, useContext } from "react";

//ui
import { Button, Select, MenuItem, TextField } from "@material-ui/core";

//logic
import io from "socket.io-client";
import { DAppClient } from "@airgap/beacon-sdk";
//import _ from "underscore";
import { HexColorPicker } from "react-colorful";
import { v4 as uuidv4 } from "uuid";
import { FirebaseContext } from "./firebaseContext";
import { useSnackbar } from "notistack";

const socketURL =
  window.location.hostname === "localhost"
    ? "ws://localhost:8000"
    : "wss://network1-backend.herokuapp.com";

const socket = io(socketURL, { transports: ["websocket"] });
const dAppClient = new DAppClient({ name: "Beacon Docs" });
const versionNames = ["0", "v1.0", "v2.0"];
const tempID = uuidv4();

function App() {
  const [activeAccount, setActiveAccount] = useState();
  const [synced, setSynced] = useState("sync");
  const [showUnsync, setShowUnsync] = useState(false);
  const [color, setColor] = useState("#FFFF00");
  const { getProfileFB, setProfileFB, getAllProfilesFB } =
    useContext(FirebaseContext);
  const [profile, setProfile] = useState({
    color: color,
    timestamp: Date.now(),
    key: tempID,
    username: "",
  });
  const [profiles, setProfiles] = useState([
    { color: "blue", timestamp: Date.now(), key: tempID, username: "user x" },
  ]);
  const [usernameInput, setUsernameInput] = React.useState("");
  const { enqueueSnackbar } = useSnackbar();
  const [statusHistory, setStatusHistory] = useState([]);
  const [version, setVersion] = useState(1);

  const handleChangeUsername = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value.length < 25) setUsernameInput(event.target.value);
    else setUsernameInput(event.target.value.slice(0, 25));
  };

  useEffect(() => {
    async function getProfiles() {
      let result = await getAllProfilesFB();
      setProfiles(result.recentStatus);
      setStatusHistory(result.history);
    }
    getProfiles();
  }, [getAllProfilesFB]);

  useEffect(() => {
    const onProfileChange = (data) => {
      setStatusHistory(
        statusHistory
          .concat(data)
          .sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp))
      );

      //recent
      profiles.find(function (prof, index) {
        if (prof.key === data.key) {
          setProfiles([
            ...profiles.slice(0, index),
            data,
            ...profiles.slice(index + 1),
          ]);
          return true;
        }
        return false;
      });
    };

    socket.on("profile", onProfileChange);

    return () => {
      socket.off("profile", onProfileChange);
    };
  }, [profiles, setProfiles, statusHistory]);

  useEffect(() => {
    async function getAcc() {
      setActiveAccount(await dAppClient.getActiveAccount());
      if (activeAccount) {
        setSynced(
          activeAccount.address.slice(0, 6) +
          "..." +
          activeAccount.address.slice(32, 36)
        );
        setShowUnsync(true);
        let tempProfile = await getProfileFB(activeAccount.address);
        setProfile(tempProfile);
        setUsernameInput(tempProfile.username);
      } else {
        setSynced("sync");
        setShowUnsync(false);
      }
    }
    getAcc();
  }, [activeAccount, getProfileFB]);

  async function unsync() {
    setActiveAccount(await dAppClient.getActiveAccount());
    if (activeAccount) {
      // User already has account connected, everything is ready
      dAppClient.clearActiveAccount().then(async () => {
        setActiveAccount(await dAppClient.getActiveAccount());
        setSynced("sync");
        setShowUnsync(false);
      });
    }
  }

  async function sync() {
    setActiveAccount(await dAppClient.getActiveAccount());
    //Already connected
    if (activeAccount) {
      setSynced(activeAccount.address);
      setShowUnsync(true);

      return activeAccount;
    }
    // The user is not synced yet
    else {
      try {
        console.log("Requesting permissions...");
        const permissions = await dAppClient.requestPermissions();
        setActiveAccount(await dAppClient.getActiveAccount());
        console.log("Got permissions:", permissions.address);
        setSynced(permissions.address);
        setShowUnsync(true);
      } catch (error) {
        console.log("Got error:", error);
      }
    }
  }

  function updateStatus() {
    if (activeAccount) {
      let timestamp = Date.now();
      console.log(timestamp);
      setProfile({
        ...profile,
        color: color,
        key: activeAccount.address,
        username: usernameInput,
        timestamp: timestamp,
      });
      //add socket
      socket.emit("profile", {
        ...profile,
        color: color,
        key: activeAccount.address,
        username: usernameInput,
        timestamp: timestamp,
      });
      setProfileFB({
        ...profile,
        color: color,
        key: activeAccount.address,
        username: usernameInput,
        timestamp: timestamp,
      });
      setStatusHistory(
        statusHistory
          .concat([
            {
              ...profile,
              color: color,
              key: activeAccount.address,
              username: usernameInput,
              timestamp: timestamp,
            },
          ])
          .sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp))
      );
      enqueueSnackbar("Status Updated ! ", {
        variant: "success",
      });
      setUsernameInput("");
    } else {
      sync();
    }
  }

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      updateStatus();
    }
  };

  return (
    <div>
      <div
        className="top-left"
        style={{
          fontSize: "1em",
          display: "flex",
          alignItems: "center",
          margin: 6,
        }}
      >
        <b>Network </b>
        &nbsp;
        <Select
          value={version}
          label="version"
          onChange={(e) => {
            window.location.href = "https://adventurepizza.github.io/Network2/";
            return null;
          }}
        >
          <MenuItem value={1}> {versionNames[1]}</MenuItem>
          <MenuItem value={2}> {versionNames[2]}</MenuItem>
        </Select>
        &nbsp; 📠
      </div>

      <div style={{ fontSize: "0.9em", marginTop: 13, marginLeft: 13 }}>
        <b>History</b>
      </div>
      <div
        style={{
          display: "flex",
          width: "90%",
          marginLeft: "auto",
          marginRight: "auto",
          overflowX: "scroll",
        }}
      >
        {statusHistory &&
          statusHistory.map((profile) => (
            <div
              key={profile.timestamp}
              style={{ textAlign: "center", margin: 6 }}
            >
              <div
                style={{
                  width: 80,
                  height: 20,
                  backgroundColor: profile.color,
                  border: "solid 4px ",
                  marginInline: 4,
                }}
              ></div>
              <Button
                title={profile.key}
                size={"small"}
                onClick={async () => {
                  navigator.clipboard.writeText(profile.key);
                  enqueueSnackbar("Address copied ! " + profile.key, {
                    variant: "success",
                  });
                }}
              >
                {profile.username}{" "}
              </Button>
            </div>
          ))}
      </div>

      <div style={{ fontSize: "0.9em", marginTop: 6, marginLeft: 13 }}>
        <b>Recent Status</b>
      </div>
      <div
        style={{
          display: "flex",
          width: "90%",
          marginLeft: "auto",
          marginRight: "auto",
          overflowX: "scroll",
        }}
      >
        <div style={{ textAlign: "center", margin: 6 }}>
          <div
            style={{
              width: 80,
              height: 20,
              backgroundColor: profile.color,
              border: "solid 4px ",
              marginInline: 4,
            }}
          ></div>

          <Button
            title={profile.key}
            size={"small"}
            onClick={async () => {
              navigator.clipboard.writeText(profile.key);
              enqueueSnackbar("Address copied ! " + profile.key, {
                variant: "success",
              });
            }}
          >
            {profile.username}{" "}
          </Button>
        </div>

        {profiles &&
          profiles.map(
            (profile) =>
              (!activeAccount || profile.key !== activeAccount.address) && (
                <div
                  key={profile.key}
                  style={{ textAlign: "center", margin: 6 }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 20,
                      backgroundColor: profile.color,
                      border: "solid 4px ",
                      marginInline: 4,
                    }}
                  ></div>
                  <Button
                    title={profile.key}
                    size={"small"}
                    onClick={async () => {
                      navigator.clipboard.writeText(profile.key);
                      enqueueSnackbar("Address copied ! " + profile.key, {
                        variant: "success",
                      });
                    }}
                  >
                    {profile.username}{" "}
                  </Button>
                </div>
              )
          )}
      </div>

      <div style={{ width: "90%", marginLeft: "auto", marginRight: "auto" }}>
        <HexColorPicker color={color} onChange={setColor} />
        <br></br>
        <div style={{ display: "flex", alignItems: "center" }}>
          <TextField
            id="outlined-basic"
            label="info"
            variant="outlined"
            placeholder="Status"
            size="small"
            onChange={handleChangeUsername}
            value={usernameInput}
            onKeyPress={handleKeyPress}
          />
          <Button
            size={"small"}
            title={"update status"}
            onClick={() => {
              updateStatus();
            }}
          >
            {" "}
            {activeAccount ? (
              <u>update status</u>
            ) : (
              <u>sync to join network1</u>
            )}{" "}
          </Button>
        </div>
      </div>

      <div className="bottom-left" style={{ position: "absolute" }}>
        <Button title={"Adventure Networks"} size={"small"} onClick={() => { }}>
          {" "}
          <div style={{ textAlign: "left" }}>
            {" "}
            Adventure <br></br>Networks{" "}
          </div>{" "}
        </Button>
      </div>

      <div
        className="bottom-right"
        style={{ position: "absolute", display: "flex", alignItems: "center" }}
      >
        {showUnsync && (
          <Button
            size={"small"}
            title={"unsync"}
            onClick={() => {
              unsync();
            }}
          >
            <u>unsync</u>{" "}
          </Button>
        )}

        {showUnsync && <div> | </div>}
        <Button
          title={"sync"}
          size={"small"}
          onClick={async () => {
            await sync();
          }}
        >
          <u>{synced}</u>{" "}
        </Button>
      </div>
    </div>
  );
}

export default App;
