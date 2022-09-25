import type { NextPage } from "next";
import Head from "next/head";
import React from "react";
import { Map } from "../components/map";
import data from '../data.json';
import { Keyframe } from "../typings";

type State = keyof typeof data;

const Home: NextPage = () => {
  const [state, setState] = React.useState<State>('dev1');
  const [keyframes, setKeyframes] = React.useState<Keyframe[] | undefined>(data[state] as Keyframe[]);

  const updateState = React.useCallback((state: State) => {
    setKeyframes(undefined);
    setState(state);

    setTimeout(() => {
      setKeyframes(data[state] as Keyframe[])
    }, 500);
  }, []);

  return (
    <>
      <Head>
        <title>HackNU 20222</title>
        <meta name="description" content="Google Case. Kazymbetov + Orel" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        {
          keyframes && (<Map zoom={18} keyframes={keyframes} />)
        }
        <div className="fixed top-2 left-2 bg-white rounded-md shadow-md py-2">
          {Object.keys(data).map((el) => (
            <button className={`block w-48 text-left px-4 py-2 ${state === el ? 'bg-blue-500 text-white' : ''}`} key={el} onClick={() => updateState(el as State)}>
              {el}
            </button>
          ))}
        </div>
      </main>
    </>
  );
};

export default Home;
