import {CPU} from "../Processor/CPU.js";

export class CpuEmulator extends HTMLElement {
    constructor() {
        super();

        // Load attributes
        this.binaryPath = this.attributes['cpu-binary'].value;
        this.memorySize = this.attributes['memory-size'] ? parseInt(this.attributes['memory-size'].value) : 0x256;
        this.stackWatch = this.attributes['stack-watch'] ? this.attributes['stack-watch'].value : "dynamic";
        this.watchedRegisters = this.attributes['watched-registers'] ?
            this.attributes['watched-registers'].value.split(',')
            : [];

        // Create subview, append and modify
        this.assemblyView = document.createElement('cpu-assembly');
        this.registersView = document.createElement('cpu-registers');
        this.memoryView = document.createElement('cpu-memory');

        this.appendChild(this.assemblyView);
        this.appendChild(this.registersView);
        this.appendChild(this.memoryView);

        this.stepButton = document.createElement('button');
        this.stepButton.innerText = "Step";
        {const veryMuchThis = this; this.stepButton.onclick = () => {veryMuchThis.stepCPU()};}

        this.appendChild(this.stepButton);

        this.watchedRegisters.forEach((register) => {
            this.registersView.addRegisterView(register);
        });

        this.memoryView.memorySize = this.memorySize;

        // Load CPU
        CpuEmulator.loadBinary(this.binaryPath, (binary) => {
            var hexDump = "";
            binary.forEach((byte) => {
                hexDump += byte.toString(16).padStart(2, "0") + " ";
            });

            console.log("Loading code: ");
            console.log(hexDump);

            this.cpu = new CPU(this.memorySize);
            this.cpu.loadCode(binary);

            console.log("Loaded CPU. Disassembly: \n" + this.cpu.fullDisassembledCode().join("\n"));

            this.onCPULoad();
        });
    }

    onCPULoad() {
        this.assemblyView.loadAssembly(this.cpu.fullDisassembledCode());

        // Subscribe to memory changes
        this.cpu.memory.subscribe(() => {
            let rsp = this.stackWatch === "dynamic" ? this.cpu.registers.reg("rsp") : parseInt(this.stackWatch);

            let stack = this.cpu.memory.load(rsp, this.cpu.memory.memory.length - rsp);

            this.memoryView.setMemory(stack);
        });

        this.cpu.registers.subscribe((reg, value) => {
            if (this.watchedRegisters.includes(reg.toLowerCase())) {
                if (reg.toLowerCase() === "rip") {
                    this.assemblyView.setCurrentLine(value);
                }

                this.registersView.updateRegister(reg, value);
            }
        });

        let rsp = this.stackWatch === "dynamic" ? this.cpu.registers.reg("rsp") : parseInt(this.stackWatch);
        let stack = this.cpu.memory.load(rsp, this.cpu.memory.memory.length - rsp);
        this.memoryView.setMemory(stack);

        this.assemblyView.setCurrentLine(this.cpu.registers.reg('rip'));

        this.cpu.registers.notifyAll();
    }

    stepCPU() {
        this.cpu.nextInstruction();
    }

    static loadBinary(binaryPath, callback) {
        const request = new XMLHttpRequest();
        request.open("GET", binaryPath, true);
        request.responseType = "arraybuffer";

        request.onload = (event) => {
            const binary = request.response;
            if (!binary) {
                throw Error(`Could not load binary from path: ${binaryPath}`);
            }

            callback(new Uint8Array(binary));
        };

        request.send(null);
    }
}