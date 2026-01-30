import { useState } from 'react';

export default function Counter({
	children,
	count: initialCount,
}: {
	children: JSX.Element;
	count: number;
}) {
	const [count, setCount] = useState(initialCount);
	const add = () => setCount((i) => i + 1);
	const subtract = () => setCount((i) => i - 1);

	return (
		<>
			<div className="grid grid-cols-3 gap-4 items-center text-2xl mt-8">
				<button className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded" onClick={subtract}>-</button>
				<pre className="text-center">{count}</pre>
				<button className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded" onClick={add}>+</button>
			</div>
			<div className="text-center mt-4">{children}</div>
		</>
	);
}
